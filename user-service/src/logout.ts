import { HttpStatus } from '@nestjs/common';

export async function logout(event) {
  return {
    statusCode: HttpStatus.OK,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify('Done'),
  };
}
