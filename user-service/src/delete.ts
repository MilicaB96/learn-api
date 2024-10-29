import { HttpStatus } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const SECRET_KEY = process.env.JWT_SECRET;
const USER_TABLE = process.env.USER_TABLE;
const STUDENT_TABLE = process.env.STUDENT_TABLE;
const TRAINER_TO_STUDENT_TABLE = process.env.TRAINER_TO_STUDENT_TABLE;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function handler(event) {
  try {
    let token = event.headers.Authorization;
    token = token.split(' ')[1];
    let decoded = jwt.verify(token, SECRET_KEY);

    const userCommand = new DeleteCommand({
      TableName: USER_TABLE,
      Key: {
        id: decoded,
      },
    });

    const userResponse = await docClient.send(userCommand);
    console.log(userResponse);
    console.log(decoded);

    const studentCommand = new ScanCommand({
      TableName: STUDENT_TABLE,
      ExpressionAttributeValues: {
        // @ts-ignore
        ':uid': { S: decoded },
      },
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      FilterExpression: '#userId = :uid',
    });

    const studentResponse = await docClient.send(studentCommand);

    console.log(
      'stuRes',
      studentResponse,
      studentResponse.Items[0].id,
      studentResponse.Items[0].id.S,
    );
    const deleteStudentCommand = new DeleteCommand({
      TableName: STUDENT_TABLE,
      Key: {
        id: studentResponse.Items[0].id.S,
        userId: studentResponse.Items[0].userId.S,
      },
    });

    const deleteStudentResponse = await docClient.send(deleteStudentCommand);
    console.log(deleteStudentResponse);

    const pivotCommand = new ScanCommand({
      TableName: TRAINER_TO_STUDENT_TABLE,
      FilterExpression: 'student.id =:value',
      ExpressionAttributeValues: {
        // @ts-ignore
        ':value': { S: decoded },
      },
    });

    const pivot = await docClient.send(pivotCommand);
    console.log('pivot', pivot);

    if (pivot.Items.length) {
      const deletePivotCommand = new DeleteCommand({
        TableName: TRAINER_TO_STUDENT_TABLE,
        Key: {
          id: pivot.Items[0].id.S,
        },
      });
      const deletePivotResponse = await docClient.send(deletePivotCommand);
      console.log(deletePivotResponse);
    }
    return {
      statusCode: HttpStatus.NO_CONTENT,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(''),
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
