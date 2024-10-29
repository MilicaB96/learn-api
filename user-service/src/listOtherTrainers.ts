import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { HttpStatus } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const SECRET_KEY = process.env.JWT_SECRET;
const USER_TABLE = process.env.USER_TABLE;
const TRAINER_TABLE = process.env.TRAINER_TABLE;
const TRAINER_TO_STUDENT_TABLE = process.env.TRAINER_TO_STUDENT_TABLE;

export async function handler(event) {
  try {
    let token = event.headers.Authorization;
    token = token.split(' ')[1];
    let decoded = jwt.verify(token, SECRET_KEY);
    //get student user
    const commandUser = new GetCommand({
      TableName: USER_TABLE,
      Key: {
        // @ts-ignore
        id: decoded,
      },
    });
    const user = await docClient.send(commandUser);

    const pivotCommand = new ScanCommand({
      TableName: TRAINER_TO_STUDENT_TABLE,
      FilterExpression: 'student.id =:value',
      ExpressionAttributeValues: {
        ':value': { S: user.Item.id },
      },
      ProjectionExpression: 'trainer.id',
    });
    const pivot = await docClient.send(pivotCommand);
    // get trainers from users table

    let trainerIds = {};
    if (pivot.Items.length) {
      pivot.Items.forEach((item, index) => {
        let idsKey = ':userId' + (index + 1);
        trainerIds[idsKey.toString()] = { S: item.trainer.M.id.S };
      });
    }
    const commandTrainers = new ScanCommand(
      pivot.Items.length
        ? {
            TableName: TRAINER_TABLE,
            FilterExpression:
              'NOT userId IN (' + Object.keys(trainerIds).toString() + ')',
            ExpressionAttributeValues: trainerIds,
          }
        : {
            TableName: TRAINER_TABLE,
          },
    );

    const trainers = await docClient.send(commandTrainers);

    if (!trainers.Items.length) {
      return {
        statusCode: HttpStatus.OK,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify(''),
      };
    }

    let userIds = {};
    trainers.Items.forEach((item, index) => {
      let idsKey = ':id' + (index + 1);
      userIds[idsKey.toString()] = { S: item.userId.S };
    });
    const commandUsers = new ScanCommand({
      TableName: USER_TABLE,
      FilterExpression: 'id IN (' + Object.keys(userIds).toString() + ') ',
      ExpressionAttributeValues: userIds,
    });

    const usersResponse = await docClient.send(commandUsers);
    const data = usersResponse.Items.map((item) => {
      return {
        id: item.id.S,
        firstName: item.firstName.S,
        lastName: item.lastName.S,
        email: item.email.S,
        specialization: trainers.Items.filter(
          (el) => el.userId.S == item.id.S,
        )[0].specialization.S,
      };
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
      statusCode: HttpStatus.BAD_GATEWAY,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(error),
    };
  }
}
