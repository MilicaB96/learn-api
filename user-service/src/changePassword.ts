import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';
import { HttpStatus } from '@nestjs/common';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const SECRET_KEY = process.env.JWT_SECRET;
const USER_TABLE = process.env.USER_TABLE;

export async function handler(event) {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = JSON.parse(
      event.body,
    );
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

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify('Invalid current password'),
      };
    }
    if (newPassword !== confirmNewPassword) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify("Passwords don't match"),
      };
    }

    const hashPassword = await bcrypt.hash(newPassword, 10);
    const putCommand = new UpdateCommand({
      TableName: USER_TABLE,
      Key: {
        id: user.id,
      },
      UpdateExpression: 'set password = :np',
      ExpressionAttributeValues: {
        ':np': hashPassword,
      },
      ReturnValues: 'ALL_NEW',
    });

    const putResponse = await docClient.send(putCommand);

    return {
      statusCode: HttpStatus.NO_CONTENT,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
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
