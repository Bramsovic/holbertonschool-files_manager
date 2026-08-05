import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body;

    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }

    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }

    const users = dbClient.usersCollection();
    const existingUser = await users.findOne({ email });

    if (existingUser) {
      response.status(400).json({ error: 'Already exist' });
      return;
    }

    const result = await users.insertOne({
      email,
      password: sha1(password),
    });

    response.status(201).json({
      id: result.insertedId,
      email,
    });
  }

  static async getMe(request, response) {
    const token = request.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await dbClient.userById(userId);

    if (!user) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    response.status(200).json({
      id: user._id,
      email: user.email,
    });
  }
}

export default UsersController;
