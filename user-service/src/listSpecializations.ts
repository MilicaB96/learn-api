import { HttpStatus } from '@nestjs/common';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const SPECIALIZATION_TABLE = process.env.SPECIALIZATION_TABLE;

export async function handler(event) {
  try {
    const command = new ScanCommand({
      TableName: SPECIALIZATION_TABLE,
      ProjectionExpression: 'specialization,id',
    });

    const response = await docClient.send(command);
    const specializations = response.Items.map(({ id, specialization }) => ({
      id: id.S,
      specialization: specialization.S,
    }));
    return {
      statusCode: HttpStatus.OK,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(specializations),
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
