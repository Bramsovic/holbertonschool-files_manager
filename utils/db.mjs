import { MongoClient, ObjectID } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}/${database}`;

    this.db = null;
    this.client = new MongoClient(url, { useUnifiedTopology: true });

    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
      })
      .catch((error) => {
        console.log(error);
      });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }

  usersCollection() {
    return this.db.collection('users');
  }

  filesCollection() {
    return this.db.collection('files');
  }

  async userById(id) {
    return this.usersCollection().findOne({ _id: ObjectID(id) });
  }

  async fileById(id) {
    return this.filesCollection().findOne({ _id: ObjectID(id) });
  }
}

const dbClient = new DBClient();

export default dbClient;
