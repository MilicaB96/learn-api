import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { HttpStatus } from '@nestjs/common';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const SECRET_KEY = process.env.JWT_SECRET;
const TRAINER_TO_STUDENT_TABLE = process.env.TRAINER_TO_STUDENT_TABLE;
const USER_TABLE = process.env.USER_TABLE;
const TRAINER_TABLE = process.env.TRAINER_TABLE;
const STUDENT_TABLE = process.env.STUDENT_TABLE;

export async function handler(event) {
  try {
    let token = event.headers.Authorization;
    token = token.split(' ')[1];
    let decoded = jwt.verify(token, SECRET_KEY);

    //UserTable
    const command = new GetCommand({
      TableName: USER_TABLE,
      Key: {
        // @ts-ignore
        id: decoded,
      },
    });

    const user = await docClient.send(command);

    const pivotCommand = new ScanCommand({
      TableName: TRAINER_TO_STUDENT_TABLE,
      FilterExpression: 'student.id =:value',
      ExpressionAttributeValues: {
        ':value': { S: user.Item.id },
      },
    });

    const pivot = await docClient.send(pivotCommand);
    let data = [];
    pivot.Items.map((item) => {
      data.push({
        id: item.trainer.M.id.S,
        firstName: item.trainer.M.firstName.S,
        lastName: item.trainer.M.lastName.S,
        specialization: item.trainer.M.specialization.S,
      });
    });

    return {
      statusCode: HttpStatus.OK,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(data),
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
