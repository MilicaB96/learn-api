import {
  DynamoDBClient,
  ScanCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { GetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { HttpStatus } from '@nestjs/common';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const SECRET_KEY = process.env.JWT_SECRET;
const USER_TABLE = process.env.USER_TABLE;
const TRAINER_TABLE = process.env.TRAINER_TABLE;
const STUDENT_TABLE = process.env.STUDENT_TABLE;
const TRAINER_TO_STUDENT_TABLE = process.env.TRAINER_TO_STUDENT_TABLE;

export async function handler(event) {
  try {
    let payload = {};
    const body = JSON.parse(event.body);
    console.log('body', body);
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
    console.log('user', user);

    let userData = {
      id: { S: user.Item.id },
      username: body?.username
        ? { S: body?.username }
        : { S: user?.Item.username },
      firstName: body.firstName
        ? { S: body?.firstName }
        : { S: user?.Item.firstName },
      lastName: body?.lastName
        ? { S: body?.lastName }
        : { S: user?.Item.lastName },
      email: body?.email ? { S: body?.email } : { S: user?.Item.email },
      isActive:
        'isActive' in body
          ? { BOOL: body?.isActive }
          : { BOOL: user?.Item.isActive },
      password: { S: user.Item.password },
    };

    console.log('userData', userData);

    const userCommand = new PutItemCommand({
      TableName: USER_TABLE,
      Item: userData,
    });

    const userResponse = await docClient.send(userCommand);
    console.log('userResponse', userResponse);

    const trainerCommand = new ScanCommand({
      TableName: TRAINER_TABLE,
      ExpressionAttributeValues: {
        ':uid': { S: user?.Item.id },
      },
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      FilterExpression: '#userId = :uid',
    });

    const trainerResponse = await docClient.send(trainerCommand);

    console.log('trainerResponse', trainerResponse);

    const studentCommand = new ScanCommand({
      TableName: STUDENT_TABLE,
      ExpressionAttributeValues: {
        ':uid': { S: user?.Item.id },
      },
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      FilterExpression: '#userId = :uid',
    });

    const studentResponse = await docClient.send(studentCommand);
    console.log('studentResponse', studentResponse);
    let data = {};
    if (studentResponse.Items.length) {
      console.log('in students');
      data = {
        dateOfBirth: body?.dateOfBirth
          ? { S: body?.dateOfBirth }
          : { S: studentResponse?.Items[0]?.dateOfBirth?.S },
        address: body?.address
          ? { S: body?.address }
          : { S: studentResponse?.Items[0]?.address?.S },
      };
      console.log(data);
      const userCommand = new PutItemCommand({
        TableName: STUDENT_TABLE,
        Item: {
          id: { S: studentResponse.Items[0]?.id?.S },
          userId: { S: studentResponse.Items[0]?.userId?.S },
          ...data,
        },
      });

      const userResponse = await docClient.send(userCommand);
      console.log('userRes', userResponse);

      //TrainerTable
      const pivotIdCommand = new ScanCommand({
        TableName: TRAINER_TO_STUDENT_TABLE,
        FilterExpression: 'student.id =:value',
        ExpressionAttributeValues: {
          ':value': { S: user.Item.id },
        },
      });

      const pivot = await docClient.send(pivotIdCommand);

      console.log(pivot, 'pivot');
      console.log(
        pivot.Items,
        pivot.Items[0].id,
        pivot.Items[0].trainer,
        pivot.Items[0].student,
        pivot.Items[0].trainer.M,
        pivot.Items[0].student.M,
        'done',
      );
      console.log('items again', { id: pivot.Items[0]?.id });
      console.log('items again', { trainer: pivot.Items[0].trainer });
      console.log('items again', {
        student: {
          M: {
            id: userData.id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            isActive: userData.isActive,
          },
        },
      });
      console.log('items', {
        id: pivot.Items[0]?.id,
        student: {
          M: {
            id: userData.id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            isActive: userData.isActive,
          },
        },
        trainer: pivot.Items[0].trainer,
      });
      if (pivot.Items.length) {
        const pivotCommand = new PutItemCommand({
          TableName: TRAINER_TO_STUDENT_TABLE,
          Item: {
            id: pivot.Items[0]?.id,
            student: {
              M: {
                id: userData.id,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                isActive: userData.isActive,
              },
            },
            trainer: pivot.Items[0].trainer,
          },
        });

        const pivotResponse = await docClient.send(pivotCommand);
        console.log('pivotRes', pivotResponse);
      }
      payload = {
        id: userData.id.S,
        firstName: userData.firstName.S,
        lastName: userData.lastName.S,
        email: userData.email.S,
        username: userData.username.S,
        isActive: userData.isActive.BOOL,
        // @ts-ignore
        dateOfBirth: data?.dateOfBirth?.S,
        // @ts-ignore
        address: data?.address?.S,
      };
    }
    if (trainerResponse.Items.length) {
      console.log('in trainers');

      console.log(
        body?.specialization,
        trainerResponse?.Items[0]?.specialziation,
      );

      data = {
        specialization: body?.specialization
          ? { S: body?.specialization }
          : { S: trainerResponse?.Items[0]?.specialization?.S },
      };
      console.log(data);
      const userCommand = new PutItemCommand({
        TableName: TRAINER_TABLE,
        Item: {
          id: { S: trainerResponse.Items[0]?.id.S },
          userId: { S: trainerResponse.Items[0]?.userId.S },
          ...data,
        },
      });

      const userResponse = await docClient.send(userCommand);
      console.log('userRes', userResponse);

      const pivotIdCommand = new ScanCommand({
        TableName: TRAINER_TO_STUDENT_TABLE,
        FilterExpression: 'trainer.id =:value',
        ExpressionAttributeValues: {
          ':value': { S: user.Item.id },
        },
      });

      const pivot = await docClient.send(pivotIdCommand);

      console.log(pivot, 'pivot');
      if (pivot.Items.length) {
        const pivotCommand = new PutItemCommand({
          TableName: TRAINER_TO_STUDENT_TABLE,
          Item: {
            id: pivot.Items[0]?.id,
            trainer: {
              M: {
                id: userData.id,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                isActive: userData.isActive,
              },
            },
            student: pivot.Items[0].student,
          },
        });

        const pivotResponse = await docClient.send(pivotCommand);
        console.log('pivotRes', pivotResponse);
      }
      payload = {
        id: userData.id.S,
        firstName: userData.firstName.S,
        lastName: userData.lastName.S,
        email: userData.email.S,
        username: userData.username.S,
        isActive: userData.isActive.BOOL,
        // @ts-ignore
        specialization: data?.specialization?.S,
      };
    }

    return {
      statusCode: HttpStatus.OK,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(payload),
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
