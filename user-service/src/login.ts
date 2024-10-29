import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { HttpStatus } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const SECRET_KEY = process.env.JWT_SECRET;
const USER_TABLE = process.env.USER_TABLE;
const STUDENT_TABLE = process.env.STUDENT_TABLE;
const TRAINER_TABLE = process.env.TRAINER_TABLE;
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function login(event) {
  try {
    const { username, password } = JSON.parse(event.body);
    let data = {};
    const command = new ScanCommand({
      TableName: USER_TABLE,
      ExpressionAttributeValues: {
        ':u': { S: username },
      },
      ExpressionAttributeNames: {
        '#username': 'username',
      },
      FilterExpression: '#username = :u',
    });
    const response = await docClient.send(command);

    const user = response.Items[0];
    if (!user || !bcrypt.compareSync(password, user.password.S)) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify('Invalid credentials'),
      };
    }

    data = {
      id: user.id.S,
      firstName: user.firstName.S,
      lastName: user.lastName.S,
      username: user.username.S,
      email: user.email.S,
      password: user.password.S,
      isActive: user.isActive.BOOL,
    };

    //check if its a student or trainer
    const commandStudent = new ScanCommand({
      TableName: STUDENT_TABLE,
      ExpressionAttributeValues: {
        ':uid': { S: user.id.S },
      },
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      FilterExpression: '#userId = :uid',
    });
    const responseStudent = await docClient.send(commandStudent);

    const commandTrainer = new ScanCommand({
      TableName: TRAINER_TABLE,
      ExpressionAttributeValues: {
        ':uid': { S: user.id.S },
      },
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      FilterExpression: '#userId = :uid',
    });
    const responseTrainer = await docClient.send(commandTrainer);

    if (responseTrainer.Items.length) {
      data = {
        ...data,
        specialization: responseTrainer.Items[0].specialization.S,
        role: 'trainer',
      };
    } else {
      data = {
        ...data,
        dateOfBirth: responseStudent.Items[0]?.dateOfBirth?.S,
        address: responseStudent.Items[0]?.address?.S,
        role: 'student',
      };
    }

    const token = jwt.sign(user.id.S, SECRET_KEY);

    return {
      statusCode: HttpStatus.OK,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ user: data, token: token }),
    };
  } catch (error) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(error),
    };
  }
}
