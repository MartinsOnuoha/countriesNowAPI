/* eslint-disable no-undef */

/**
 * @module test/flag
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');

const basePath = '/api/v0.1/countries';
const should = chai.should();

chai.use(chaiHttp);

describe('Flags', () => {
  describe('/GET', () => {
    it('it should get all countries and unicode flag', (done) => {
      chai.request(server)
        .get(`${basePath}/flag/unicode`)
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
    it('it should require "country" param to get single country and unicode flag', (done) => {
      chai.request(server)
        .post(`${basePath}/flag/unicode`)
        .send({})
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
    it('it should get single country and unicode flag', (done) => {
      chai.request(server)
        .post(`${basePath}/flag/unicode`)
        .send({ country: 'nigeria' })
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('msg').be.a('string').eql('countries and unicode flags retrieved');
          res.body.should.have.property('data').be.a('object').have.property('unicodeFlag');
          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should get countries and image flag', (done) => {
      chai.request(server)
        .get(`${basePath}/flag/images`)
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('msg').be.a('string').eql('flags images retrieved');
          res.body.should.have.property('data').be.a('array');
          res.body.data.length.should.not.equal(0);
          done();
        });
    });
  });
  describe('/POST', () => {
    it('it should require "country" param to get single country and image flag', (done) => {
      chai.request(server)
        .post(`${basePath}/flag/images`)
        .send({})
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
    it('it should get single country and image flag', (done) => {
      chai.request(server)
        .post(`${basePath}/flag/images`)
        .send({ country: 'nigeria' })
        .end((err, res) => {
          res.should.have.status(200);
          should.not.exist(err);
          res.body.should.be.a('object');
          res.body.should.have.property('error').eql(false);
          res.body.should.have.property('msg').be.a('string').eql('country and flag retrieved');
          res.body.should.have.property('data').be.a('object').have.property('flag');
          done();
        });
    });
  });
});
