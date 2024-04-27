import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { HttpStatus } from '@nestjs/common';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const SECRET_KEY = process.env.JWT_SECRET;
const TRAINER_TO_STUDENT_TABLE = process.env.TRAINER_TO_STUDENT_TABLE;
const USER_TABLE = process.env.USER_TABLE;
const TRAINER_TABLE = process.env.TRAINER_TABLE;

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

    //TrainerTable
    const commandTrainer = new ScanCommand({
      TableName: TRAINER_TABLE,
      ExpressionAttributeValues: {
        ':uid': { S: user.Item.id },
      },
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      FilterExpression: '#userId = :uid',
      ProjectionExpression: 'id',
    });
    const responseTrainer = await docClient.send(commandTrainer);

    //TrainerStudentPivotTable
    const commandPivot = new ScanCommand({
      TableName: TRAINER_TO_STUDENT_TABLE,
      ExpressionAttributeValues: {
        ':tid': { S: responseTrainer.Items[0].id.S },
      },
      ExpressionAttributeNames: {
        '#trainerId': 'trainerId',
      },
      FilterExpression: '#trainerId = :tid',
      ProjectionExpression: 'studentId',
    });
    const responsePivot = await docClient.send(commandPivot);

    if (!responsePivot.Items.length) {
      return {
        statusCode: HttpStatus.OK,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify(''),
      };
    }

    const studentIds = responsePivot.Items.map((obj) => {
      const id = obj.studentId.S;
      return { id };
    });

    //StudentTable
    const commandStudent = new BatchGetCommand({
      RequestItems: {
        students: {
          Keys: studentIds,
        },
      },
    });

    const responseStudents = await docClient.send(commandStudent);

    //UserTable
    const userIds = responseStudents.Responses.students.map((obj) => ({
      id: obj.userId,
    }));
    const commandUsers = new BatchGetCommand({
      RequestItems: {
        users: {
          Keys: userIds,
        },
      },
    });
    const responseUsers = await docClient.send(commandUsers);

    const data = responseUsers.Responses.users.map((item) => {
      return {
        id: item.id,
        firstName: item.firstName,
        lastName: item.lastName,
        isActive: item.isActive,
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
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(error),
    };
  }
}
