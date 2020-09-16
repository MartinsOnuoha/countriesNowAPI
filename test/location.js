/* eslint-disable no-undef */

/**
 * @module test/location
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');

const basePath = '/api/v0.1/countries';
const should = chai.should();

chai.use(chaiHttp);

describe('Capitals', () => {
  describe('/GET', () => {
    it('it should get all countries and their positions', (done) => {
      chai.request(server)
        .get(`${basePath}/positions`)
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data');
          res.body.should.have.property('data').be.a('array');
          res.body.data.length.should.not.equal(0);

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should require "country" param to get a single country and its positions', (done) => {
      chai.request(server)
        .post(`${basePath}/positions`)
        .send({ country: '' })
        .end((err, res) => {
          res.should.have.status(400);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg');
          res.body.should.have.property('msg').be.a('string');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should get a single country and its positions', (done) => {
      chai.request(server)
        .post(`${basePath}/positions`)
        .send({ country: 'nigeria' })
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data');
          res.body.should.have.property('data').be.a('object');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should filter country by range', (done) => {
      const payload = {
        type: 'long',
        min: 1,
        max: 40,
      };
      chai.request(server)
        .post(`${basePath}/positions/range`)
        .send(payload)
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data');
          res.body.should.have.property('data').be.a('array');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should require "min" param to filter country by range', (done) => {
      const payload = {
        type: 'long',
        max: 40,
      };
      chai.request(server)
        .post(`${basePath}/positions/range`)
        .send(payload)
        .end((err, res) => {
          res.should.have.status(400);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg');
          res.body.should.have.property('msg').be.a('string').eql('missing param (type, min, max)');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should require "max" param to filter country by range', (done) => {
      const payload = {
        type: 'long',
        min: 40,
      };
      chai.request(server)
        .post(`${basePath}/positions/range`)
        .send(payload)
        .end((err, res) => {
          res.should.have.status(400);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg');
          res.body.should.have.property('msg').be.a('string').eql('missing param (type, min, max)');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should require "type" param to filter country by range', (done) => {
      const payload = {
        max: 60,
        min: 40,
      };
      chai.request(server)
        .post(`${basePath}/positions/range`)
        .send(payload)
        .end((err, res) => {
          res.should.have.status(400);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg');
          res.body.should.have.property('msg').be.a('string').eql('missing param (type, min, max)');

          done();
        });
    });
  });
});
