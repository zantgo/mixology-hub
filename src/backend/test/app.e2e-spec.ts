import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  it('POST /auth/register should reject weak password', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'weak' })
      .expect(400);
  });

  it('POST /auth/login should return 401 for unknown user', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
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
