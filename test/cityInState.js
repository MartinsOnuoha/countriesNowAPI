/* eslint-disable no-undef */

/**
 * @module test/states
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');

const basePath = '/api/v0.1/countries';
const should = chai.should();

chai.use(chaiHttp);

describe('/POST', () => {
  it('it should require "country" param to get cities of particular state', (done) => {
    chai.request(server)
    .post(`${basePath}/state/cities`)
    .send({ })
    .end((err, res) => {
      res.should.have.status(400);
      should.not.exist(err);
      res.body.should.be.a('object');
      res.body.should.have.property('error').eql(true);
      res.body.should.have.property('msg');
      res.body.should.have.property('msg').eql('missing param (country)');

      done();
    });
  });
});

describe('/POST', () => {
  it('it should require "state" param to get cities of particular state', (done) => {
    chai.request(server)
    .post(`${basePath}/state/cities`)
    .send({ country: 'Afghanistan' })
    .end((err, res) => {
      res.should.have.status(400);
      should.not.exist(err);
      res.body.should.be.a('object');
      res.body.should.have.property('error').eql(true);
      res.body.should.have.property('msg');
      res.body.should.have.property('msg').eql('missing param (state)');

      done();
    });
  });
});

describe('/POST', () => {
  it('it should require "state" param to get cities of particular state', (done) => {
    chai.request(server)
    .post(`${basePath}/state/cities`)
    .send({ country: 'Afghanistan' })
    .end((err, res) => {
      res.should.have.status(400);
      should.not.exist(err);
      res.body.should.be.a('object');
      res.body.should.have.property('error').eql(true);
      res.body.should.have.property('msg');
      res.body.should.have.property('msg').eql('missing param (state)');

      done();
    });
  });
});

describe('/POST', () => {
  it('it should return 404 if "country" not found', (done) => {
    chai.request(server)
    .post(`${basePath}/state/cities`)
    .send({ country: 'XHJSDkF', state: 'adasd' })
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
  it('it should return 404 if "state" not found', (done) => {
    chai.request(server)
    .post(`${basePath}/state/cities`)
    .send({ country: 'Afghanistan', state: 'asasds' })
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
  it('it should get a single state and its city data', (done) => {
    const payload = {
      country: 'Afghanistan',
      state: 'Badakhshan'
    };
    chai.request(server)
      .post(`${basePath}/state/cities`)
      .send(payload)
      .end((err, res) => {
        res.should.have.status(200);
        should.not.exist(err);
        res.body.should.be.a('object');
        res.body.should.have.property('error').eql(false);
        res.body.should.have.property('msg');
        res.body.should.have.property('msg').eql(`cities in state ${payload.state} of country ${payload.country} retrieved`);
        res.body.should.have.property('data').be.a('array');

        done();
      });
  });
});
