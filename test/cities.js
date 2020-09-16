/* eslint-disable no-undef */

/**
 * @module test/cities
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');

const basePath = '/api/v0.1/countries';
const should = chai.should();

chai.use(chaiHttp);

describe('Cities', () => {
  describe('/GET', () => {
    it('it should get all countries and their cities', (done) => {
      chai.request(server)
        .get(basePath)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');

          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should require "country" parameter to get cities', (done) => {
      const payload = {};

      chai.request(server)
        .post(`${basePath}/cities`)
        .send(payload)
        .end((err, res) => {
          should.not.exist(err);
          res.should.have.status(400);
          res.body.should.be.a('object');
          res.body.should.have.property('error');
          res.body.should.have.property('msg');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg');

          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should return cities given "country" params', (done) => {
      const payload = {
        country: 'nigeria',
      };
      chai.request(server)
        .post(`${basePath}/cities`)
        .send(payload)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('error');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data');
          res.body.should.have.property('data').be.a('array');
          res.body.should.have.property('msg').be.a('string').eql(`cities in ${payload.country} retrieved`);
          done();
        });
    });
  });
});
