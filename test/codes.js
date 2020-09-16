/* eslint-disable no-undef */

/**
 * @module test/codes
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');

const basePath = '/api/v0.1/countries';
const should = chai.should();

chai.use(chaiHttp);

describe('Codes', () => {
  describe('/GET', () => {
    it('it should get countries and ISO2&3 codes', (done) => {
      chai.request(server)
        .get(`${basePath}/iso`)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('msg').eql('countries and ISO codes retrieved');
          res.body.should.have.property('data').be.a('array');
          res.body.data.length.should.not.eql(0);

          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should require "country" param to get single ISO2&3 code', (done) => {
      chai.request(server)
        .post(`${basePath}/iso`)
        .send({ })
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.have.property('error').eql(true);

          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should get single country and ISO2&3 codes', (done) => {
      chai.request(server)
        .post(`${basePath}/iso`)
        .send({ country: 'Nigeria' })
        .end((err, res) => {
          should.not.exist(err);
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('data').be.a('object');
          res.body.should.have.property('data').have.property('Iso2');

          done();
        });
    });
  });
  describe('/GET', () => {
    it('it should get countries and dial codes', (done) => {
      chai.request(server)
        .get(`${basePath}/codes`)
        .end((err, res) => {
          should.not.exist(err);
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('msg').eql('countries and codes retrieved');
          res.body.should.have.property('data').be.a('array');
          res.body.data.length.should.not.eql(0);

          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should require "country" param to get single country dial code', (done) => {
      chai.request(server)
        .post(`${basePath}/codes`)
        .send({ })
        .end((err, res) => {
          res.should.have.status(400);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(true);

          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should get single country and dial code', (done) => {
      chai.request(server)
        .post(`${basePath}/codes`)
        .send({ country: 'nigeria' })
        .end((err, res) => {
          should.not.exist(err);
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('msg').eql('nigeria dail code retrieved');
          res.body.should.have.property('data').be.a('object');
          res.body.data.should.have.property('dial_code').be.eql('+234');

          done();
        });
    });
  });
});
