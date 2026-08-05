import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(request, response) {
    const authorization = request.header('Authorization') || '';
    const auth = authorization.split(' ');

    if (auth.length !== 2 || auth[0] !== 'Basic') {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const credentials = Buffer.from(auth[1], 'base64').toString('utf-8');
    const separator = credentials.indexOf(':');

    if (separator === -1) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const email = credentials.substring(0, separator);
    const password = credentials.substring(separator + 1);
    const user = await dbClient.usersCollection().findOne({
      email,
      password: sha1(password),
    });

    if (!user) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = uuidv4();

    await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);
    response.status(200).json({ token });
  }

  static async getDisconnect(request, response) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await redisClient.del(key);
    response.status(204).send();
  }
}

export default AuthController;
