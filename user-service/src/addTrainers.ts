import {
  BatchWriteItemCommand,
  DynamoDBClient,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { HttpStatus } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';

const SECRET_KEY = process.env.JWT_SECRET;
const USER_TABLE = process.env.USER_TABLE;
const TRAINER_TABLE = process.env.TRAINER_TABLE;
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function handler(event) {
  try {
    const { ids } = JSON.parse(event.body);
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

    const userDecoded = await docClient.send(command);

    //user trainer table
    const userIds = ids.map((id) => {
      return { id: id };
    });
    const commandUsersTrainers = new BatchGetCommand({
      RequestItems: {
        users: {
          Keys: userIds,
        },
      },
    });

    const usersTrainers = await docClient.send(commandUsersTrainers);
    //get triainers

    let trainerIds = {};
    ids.forEach((id, index) => {
      let idsKey = ':userId' + (index + 1);
      trainerIds[idsKey.toString()] = { S: id };
    });

    const commandTrainers = new ScanCommand({
      TableName: TRAINER_TABLE,
      FilterExpression:
        'userId IN (' + Object.keys(trainerIds).toString() + ')',
      ExpressionAttributeValues: trainerIds,
    });

    const trainers = await docClient.send(commandTrainers);

    const data = usersTrainers.Responses.users.map((item) => {
      return {
        PutRequest: {
          Item: {
            id: { S: uuidv4() },
            student: {
              M: {
                id: { S: userDecoded.Item.id },
                firstName: { S: userDecoded.Item.firstName },
                lastName: { S: userDecoded.Item.lastName },
                email: { S: userDecoded.Item.email },
                isActive: { BOOL: userDecoded.Item.isActive },
              },
            },
            trainer: {
              M: {
                id: { S: item.id },
                firstName: { S: item.firstName },
                lastName: { S: item.lastName },
                email: { S: item.email },
                specialization: {
                  S: trainers.Items.filter((el) => el.userId.S == item.id)[0]
                    .specialization.S,
                },
              },
            },
          },
        },
      };
    });
    const commandPivot = new BatchWriteItemCommand({
      RequestItems: {
        // @ts-ignore
        trainerToStudent: data,
      },
    });
    const result = await client.send(commandPivot);

    let payload = usersTrainers.Responses.users.map((item) => {
      return {
        id: item.id,
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        specialization: trainers.Items.filter((el) => el.userId.S == item.id)[0]
          .specialization.S,
      };
    });

    return {
      statusCode: HttpStatus.CREATED,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(payload),
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
