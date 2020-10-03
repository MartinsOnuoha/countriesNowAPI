/* eslint-disable no-undef */

/**
 * @module test/random
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');

const basePath = '/api/v0.1/countries';
const should = chai.should();

chai.use(chaiHttp);

describe("Random",()=>{
    describe("/GET",()=>{
        it('it should get a random country object',(done)=>{
            chai.request(server)
              .get(`${basePath}/random`)
              .end((err,res)=>{
                  res.should.have.status(200);
                  res.body.should.be.a('object');
                  res.body.should.have.property('error').eql(false);
                  res.body.should.have.property('data');
                  res.body.should.have.property('msg');
                  res.body.should.have.property('data').be.a('object');
                  res.body.data.should.have.property('name');
                  res.body.data.should.have.property('dial_code');
                  res.body.data.should.have.property('code');
                  res.body.data.should.have.property('latitude');
                  res.body.data.should.have.property('longitude');
                  done();
              })
        })    
    })
})