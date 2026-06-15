import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';

const getCsrfHeaders = async (
  appServer: ReturnType<INestApplication<App>['getHttpServer']>,
) => {
  const res = await request(appServer).get('/auth/csrf');
  const csrfToken = res.body.csrfToken;
  const rawCookies = res.headers['set-cookie'] as string[];
  const cookieValue = rawCookies
    ?.map((c: string) => c.split(';')[0])
    .join('; ');
  return {
    headers: { 'X-CSRF-Token': csrfToken },
    cookies: cookieValue,
  };
};

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: (errors) => {
          const mapped = errors.map((error) => ({
            field: error.property,
            constraints: error.constraints ?? null,
            children:
              error.children && error.children.length > 0
                ? error.children.map((child) => ({
                    field: child.property,
                    constraints: child.constraints ?? null,
                  }))
                : undefined,
          }));
          return new BadRequestException({
            message: 'Validation failed',
            statusCode: 400,
            errors: mapped,
          });
        },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns Hello World', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('GET /health returns health status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: { body: Record<string, unknown> }) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('checks');
        expect(res.body.checks).toHaveProperty('db');
        expect(res.body.checks).toHaveProperty('redis');
      });
  });

  it('POST /auth/register should reject weak password', async () => {
    const { headers, cookies } = await getCsrfHeaders(app.getHttpServer());
    return request(app.getHttpServer())
      .post('/auth/register')
      .set(headers)
      .set('Cookie', cookies)
      .send({ email: 'test@example.com', password: 'weak' })
      .expect(400);
  });

  it('POST /auth/login should return 401 for unknown user', async () => {
    const { headers, cookies } = await getCsrfHeaders(app.getHttpServer());
    return request(app.getHttpServer())
      .post('/auth/login')
      .set(headers)
      .set('Cookie', cookies)
      .send({ email: 'nonexistent@example.com', password: 'Password123!' })
      .expect(401);
  });

  it('GET /cocktails returns paginated results', () => {
    return request(app.getHttpServer())
      .get('/cocktails?limit=5')
      .expect(200)
      .expect((res: { body: Record<string, unknown> }) => {
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body.meta).toHaveProperty('currentPage');
      });
  });

  it('GET /cocktails?fuzzy=true returns results', () => {
    return request(app.getHttpServer())
      .get('/cocktails?name=margarita&fuzzy=true&limit=5')
      .expect(200)
      .expect((res: { body: { meta: unknown } }) => {
        expect(res.body.meta).toBeDefined();
      });
  });

  it('GET /bar-inventory returns status', () => {
    return request(app.getHttpServer()).get('/bar-inventory').expect(200);
  });

  it('GET unknown path returns 404', () => {
    return request(app.getHttpServer()).get('/nonexistent').expect(404);
  });
});
