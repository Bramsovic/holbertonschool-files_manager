import { promises as fs } from 'fs';
import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import { ObjectID } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');
const widths = [500, 250, 100];

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  const file = await dbClient.filesCollection().findOne({
    _id: ObjectID(fileId),
    userId: ObjectID(userId),
  });

  if (!file) {
    throw new Error('File not found');
  }

  await Promise.all(widths.map(async (width) => {
    const thumbnail = await imageThumbnail(file.localPath, { width });

    await fs.writeFile(`${file.localPath}_${width}`, thumbnail);
  }));
});
