import { HttpStatus } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { plainToClass } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import {
  CreateStudentDto,
  CreateTrainerDto,
  CreateUserDto,
} from './dto/create-user.dto';
import { randomWordGenerator } from './helpers/randomWordGenerator';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const SECRET_KEY = process.env.JWT_SECRET;
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function register(event) {
  try {
    const user = JSON.parse(event.body);

    if (!user.role) {
      return {
        statusCode: HttpStatus.BAD_GATEWAY,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify('User role is not provided'),
      };
    }

    const dto: CreateUserDto = plainToClass(CreateUserDto, user);
    await validateOrReject(dto, {
      validationError: { target: false },
    });

    user.password = randomWordGenerator(10);
    user.username = user.firstName + randomWordGenerator(2);
    user.isActive = true;
    user.id = uuidv4();

    if (user.role == 'student') {
      const id = uuidv4();
      const dto: CreateStudentDto = plainToClass(CreateStudentDto, user);
      await validateOrReject(dto, {
        validationError: { target: false },
      });
      const data = {
        id: id,
        userId: user.id,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
      };
      await docClient.send(
        new PutCommand({
          TableName: process.env.STUDENT_TABLE,
          Item: data,
        }),
      );
    } else if (user.role == 'trainer') {
      const id = uuidv4();
      const dto: CreateTrainerDto = plainToClass(CreateTrainerDto, user);
      await validateOrReject(dto, {
        validationError: { target: false },
      });
      const data = {
        id: id,
        userId: user.id,
        specialization: user.specialization,
      };
      await docClient.send(
        new PutCommand({
          TableName: process.env.TRAINER_TABLE,
          Item: data,
        }),
      );
    } else {
      return {
        statusCode: HttpStatus.BAD_GATEWAY,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify('Invalid User Role'),
      };
    }

    const hashPassword = await bcrypt.hash(user.password, 10);
    const data = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      password: hashPassword,
      isActive: user.isActive,
      role: user.role,
    };

    await docClient.send(
      new PutCommand({
        TableName: process.env.USER_TABLE,
        Item: data,
      }),
    );

    const token = jwt.sign(user.id, SECRET_KEY);

    return {
      statusCode: HttpStatus.OK,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ user: user, token: token }),
    };
  } catch (error) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(error),
    };
  }
}
