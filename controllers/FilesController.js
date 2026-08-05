import { promises as fs } from 'fs';
import path from 'path';
import Queue from 'bull';
import { ObjectID } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const fileQueue = new Queue('fileQueue');

class FilesController {
  static formatFile(file) {
    return {
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    };
  }

  static async getUserId(request, response) {
    const token = request.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return null;
    }

    return userId;
  }

  static async getUserIdFromToken(request) {
    const token = request.header('X-Token');

    if (!token) {
      return null;
    }

    return redisClient.get(`auth_${token}`);
  }

  static async postUpload(request, response) {
    const userId = await FilesController.getUserId(request, response);

    if (!userId) {
      return;
    }

    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = request.body;
    const types = ['folder', 'file', 'image'];

    if (!name) {
      response.status(400).json({ error: 'Missing name' });
      return;
    }

    if (!type || !types.includes(type)) {
      response.status(400).json({ error: 'Missing type' });
      return;
    }

    if (type !== 'folder' && !data) {
      response.status(400).json({ error: 'Missing data' });
      return;
    }

    let fileParentId = parentId;

    if (parentId !== 0 && parentId !== '0') {
      let parentFile;

      try {
        parentFile = await dbClient.fileById(parentId);
      } catch (error) {
        parentFile = null;
      }

      if (!parentFile) {
        response.status(400).json({ error: 'Parent not found' });
        return;
      }

      if (parentFile.type !== 'folder') {
        response.status(400).json({ error: 'Parent is not a folder' });
        return;
      }

      fileParentId = ObjectID(parentId);
    }

    const file = {
      userId: ObjectID(userId),
      name,
      type,
      isPublic,
      parentId: fileParentId,
    };

    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const localPath = path.resolve(folderPath, uuidv4());

      await fs.mkdir(folderPath, { recursive: true });
      await fs.writeFile(localPath, Buffer.from(data, 'base64'));
      file.localPath = localPath;
    }

    const result = await dbClient.filesCollection().insertOne(file);

    if (type === 'image') {
      await fileQueue.add({
        userId,
        fileId: result.insertedId.toString(),
      });
    }

    response.status(201).json(FilesController.formatFile({
      _id: result.insertedId,
      ...file,
    }));
  }

  static async getShow(request, response) {
    const userId = await FilesController.getUserId(request, response);

    if (!userId) {
      return;
    }

    let file;

    try {
      file = await dbClient.filesCollection().findOne({
        _id: ObjectID(request.params.id),
        userId: ObjectID(userId),
      });
    } catch (error) {
      file = null;
    }

    if (!file) {
      response.status(404).json({ error: 'Not found' });
      return;
    }

    response.status(200).json(FilesController.formatFile(file));
  }

  static async getIndex(request, response) {
    const userId = await FilesController.getUserId(request, response);

    if (!userId) {
      return;
    }

    const { parentId = 0 } = request.query;
    const page = Number(request.query.page) || 0;
    const parentIds = parentId === 0 || parentId === '0'
      ? [0, '0']
      : [parentId];

    if (parentId !== 0 && parentId !== '0' && ObjectID.isValid(parentId)) {
      parentIds.push(ObjectID(parentId));
    }

    const files = await dbClient.filesCollection().aggregate([
      {
        $match: {
          userId: ObjectID(userId),
          parentId: { $in: parentIds },
        },
      },
      { $skip: page * 20 },
      { $limit: 20 },
    ]).toArray();

    response.status(200).json(files.map((file) => FilesController.formatFile(file)));
  }

  static async updatePublishStatus(request, response, isPublic) {
    const userId = await FilesController.getUserId(request, response);

    if (!userId) {
      return;
    }

    let file;

    try {
      file = await dbClient.filesCollection().findOneAndUpdate(
        {
          _id: ObjectID(request.params.id),
          userId: ObjectID(userId),
        },
        {
          $set: { isPublic },
        },
        {
          returnOriginal: false,
        },
      );
    } catch (error) {
      file = null;
    }

    if (!file || !file.value) {
      response.status(404).json({ error: 'Not found' });
      return;
    }

    response.status(200).json(FilesController.formatFile(file.value));
  }

  static async putPublish(request, response) {
    await FilesController.updatePublishStatus(request, response, true);
  }

  static async putUnpublish(request, response) {
    await FilesController.updatePublishStatus(request, response, false);
  }

  static async getFile(request, response) {
    let file;

    try {
      file = await dbClient.filesCollection().findOne({
        _id: ObjectID(request.params.id),
      });
    } catch (error) {
      file = null;
    }

    if (!file) {
      response.status(404).json({ error: 'Not found' });
      return;
    }

    const userId = await FilesController.getUserIdFromToken(request);

    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      response.status(404).json({ error: 'Not found' });
      return;
    }

    if (file.type === 'folder') {
      response.status(400).json({ error: "A folder doesn't have content" });
      return;
    }

    let data;
    let filePath = file.localPath;
    const { size } = request.query;

    if (size && ['500', '250', '100'].includes(size)) {
      filePath = `${file.localPath}_${size}`;
    }

    try {
      data = await fs.readFile(filePath);
    } catch (error) {
      response.status(404).json({ error: 'Not found' });
      return;
    }

    response.type(mime.lookup(file.name) || 'application/octet-stream');
    response.status(200).send(data);
  }
}

export default FilesController;
