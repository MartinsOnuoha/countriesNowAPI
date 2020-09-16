/* eslint-disable no-undef */

/**
 * @module test/capital
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');

const basePath = '/api/v0.1/countries';
const should = chai.should();

chai.use(chaiHttp);

describe('Capitals', () => {
  describe('/GET', () => {
    it('it should get all countries and their capital', (done) => {
      chai.request(server)
        .get(`${basePath}/capital`)
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
    it('it should require "country" parameter to get capital', (done) => {
      chai.request(server)
        .post(`${basePath}/capital`)
        .send({})
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);
          res.body.should.have.property('msg').eql('missing param (country)');

          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should get capital of a single country', (done) => {
      chai.request(server)
        .post(`${basePath}/capital`)
        .send({ country: 'nigeria' })
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data').be.a('object');
          res.body.should.have.property('data').have.property('name').equal('Nigeria');
          res.body.should.have.property('data').have.property('capital').equal('Abuja');

          done();
        });
    });
  });
});
