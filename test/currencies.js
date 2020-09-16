/* eslint-disable no-undef */

/**
 * @module test/currencies
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');

const basePath = '/api/v0.1/countries';
const should = chai.should();

chai.use(chaiHttp);

describe('Currencies', () => {
  describe('/GET', () => {
    it('it should get all countries and their currencies', (done) => {
      chai.request(server)
        .get(`${basePath}/currency`)
        .end((err, res) => {
          should.not.exist(err);
          res.should.have.status(200);
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
    it('it should a single country and its currencies', (done) => {
      chai.request(server)
        .post(`${basePath}/currency`)
        .send({ country: 'nigeria' })
        .end((err, res) => {
          should.not.exist(err);
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data');
          res.body.should.have.property('data').be.a('object');
          res.body.should.have.property('data').have.property('currency');

          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should require "country" param to get currencies', (done) => {
      chai.request(server)
        .post(`${basePath}/currency`)
        .send({ })
        .end((err, res) => {
          should.not.exist(err);
          res.should.have.status(400);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg');
          res.body.should.have.property('msg').be.a('string');

          done();
        });
    });
  });
});
