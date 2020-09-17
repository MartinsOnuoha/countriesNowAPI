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

describe('Population', () => {
  describe('/GET', () => {
    it('it should get all countries and their states data', (done) => {
      chai.request(server)
        .get(`${basePath}/states`)
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
    it('it should require "country" param to get single country and its states data', (done) => {
      chai.request(server)
        .post(`${basePath}/states`)
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
    it('it should return 404 if "country" not found', (done) => {
      chai.request(server)
        .post(`${basePath}/states`)
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
    it('it should get a single country and its states data', (done) => {
      const payload = {
        country: 'Nigeria',
      };
      chai.request(server)
        .post(`${basePath}/states`)
        .send(payload)
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('msg');
          res.body.should.have.property('msg').eql(`states in ${payload.country} retrieved`);
          res.body.should.have.property('data').be.a('object');
          res.body.should.have.property('data').have.property('states');

          done();
        });
    });
  });
});
