import { HttpStatus } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const SECRET_KEY = process.env.JWT_SECRET;
const TRAINING_TABLE = process.env.TRAINING_TABLE;
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
export async function handler(event: any) {
  try {
    console.log(TRAINING_TABLE, SECRET_KEY);
    let token = event.headers.Authorization;
    token = token.split(' ')[1];
    let decoded = jwt.verify(token, SECRET_KEY);

    console.log(decoded);

    const command = new ScanCommand({
      TableName: TRAINING_TABLE,
      FilterExpression: 'student.id =:value OR trainer.id =:value',
      ExpressionAttributeValues: {
        // @ts-ignore
        ':value': { S: decoded },
      },
    });

    const response = await docClient.send(command);
    console.log('hello there', response);

    return {
      statusCode: HttpStatus.OK,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify('response'),
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
