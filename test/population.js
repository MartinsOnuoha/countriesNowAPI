/* eslint-disable no-undef */

/**
 * @module test/population
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');

const basePath = '/api/v0.1/countries';
const should = chai.should();

chai.use(chaiHttp);

describe('Population', () => {
  describe('/GET', () => {
    it('it should get all cities and their population data', (done) => {
      chai.request(server)
        .get(`${basePath}/population/cities`)
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
    it('it should require "city" payload to get single city and population data', (done) => {
      chai.request(server)
        .post(`${basePath}/population/cities`)
        .send({ })
        .end((err, res) => {
          res.should.have.status(400);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg').be.a('string');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should return 404 if "city" not found', (done) => {
      chai.request(server)
        .post(`${basePath}/population/cities`)
        .send({ city: 'XHJSDkF' })
        .end((err, res) => {
          res.should.have.status(404);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should get single city and its population data', (done) => {
      chai.request(server)
        .post(`${basePath}/population/cities`)
        .send({ city: 'lagos' })
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data').be.a('object');
          res.body.should.have.property('data').have.property('populationCounts').be.a('array');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should filter cities and its population data', (done) => {
      const payload = {
        limit: 10,
        order: 'asc',
        orderBy: 'name',
        country: 'nigeria',
      };
      chai.request(server)
        .post(`${basePath}/population/cities/filter`)
        .send(payload)
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data').be.a('array');
          res.body.data.length.should.not.equal(0);

          done();
        });
    });
  });

  describe('/GET', () => {
    it('it should get all countries and their population data', (done) => {
      chai.request(server)
        .get(`${basePath}/population`)
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
    it('it should require "country" payload to single country and population data', (done) => {
      chai.request(server)
        .post(`${basePath}/population`)
        .send({ })
        .end((err, res) => {
          res.should.have.status(400);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg').be.a('string');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should return 404 if "country" not found', (done) => {
      chai.request(server)
        .post(`${basePath}/population`)
        .send({ country: 'XHJSDkF' })
        .end((err, res) => {
          res.should.have.status(404);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should get single country and its population data', (done) => {
      chai.request(server)
        .post(`${basePath}/population`)
        .send({ country: 'nigeria' })
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data').be.a('object');
          res.body.should.have.property('data').have.property('populationCounts').be.a('array');
          res.body.should.have.property('data').have.property('code').eql('NGA');

          done();
        });
    });
  });

  describe('/POST', () => {
    it('it should filter countries and population data', (done) => {
      const payload = {
        year: 2000,
        limit: 10,
        lt: 651348588,
        gt: 6513485,
        orderBy: 'name',
        order: 'dsc',
      };
      chai.request(server)
        .post(`${basePath}/population/filter`)
        .send(payload)
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data').be.a('array');

          done();
        });
    });
  });
});
