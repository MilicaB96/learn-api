import { HttpStatus } from '@nestjs/common';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const SECRET_KEY = process.env.JWT_SECRET;
const USER_TABLE = process.env.USER_TABLE;
const STUDENT_TABLE = process.env.STUDENT_TABLE;
const TRAINER_TABLE = process.env.TRAINER_TABLE;

export async function handler(event) {
  try {
    let token = event.headers.Authorization;
    token = token.split(' ')[1];
    let decoded = jwt.verify(token, SECRET_KEY);
    const command = new GetCommand({
      TableName: USER_TABLE,
      Key: {
        // @ts-ignore
        id: decoded,
      },
    });

    const response = await docClient.send(command);
    // @ts-ignore
    let user = { ...response.Item };
    //check if its a student or trainer
    const commandStudent = new ScanCommand({
      TableName: STUDENT_TABLE,
      ExpressionAttributeValues: {
        ':uid': { S: user?.id },
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
        ':uid': { S: user?.id },
      },
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      FilterExpression: '#userId = :uid',
    });
    const responseTrainer = await docClient.send(commandTrainer);
    if (responseTrainer.Items.length) {
      user = {
        ...user,
        specialization: responseTrainer.Items[0].specialization.S,
        role: 'trainer',
      };
    } else {
      user = {
        ...user,
        dateOfBirth: responseStudent.Items[0]?.dateOfBirth?.S,
        address: responseStudent.Items[0]?.address?.S,
        role: 'student',
      };
    }

    return {
      statusCode: HttpStatus.OK,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(user),
    };
  } catch (error) {
    return {
      statusCode: HttpStatus.BAD_GATEWAY,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(error),
    };
  }
}
