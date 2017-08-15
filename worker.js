const CoinKey = require('coinkey');
const rp = require('request-promise');
const Promise = require('bluebird');
const HashTable = require('hashtable');
const _ = require('lodash');
const wif = require('wif');

const TEST_KEY = '0000000000000000000000000000000000000000000000000000000000000001';
const TEST_ADDRESS = "1JCe8z4jJVNXSjohjM4i9Hh813dLCNx2Sy";

const returnHash = function () {
    abc = "abcdef1234567890".split("");
    let token = "";
    for (i = 0; i < 64; i++) {
        token += abc[Math.floor(Math.random() * abc.length)];
    }
    return token; //Will return a 32 bit "hash"
};

module.exports.doProcess = function () {
    process.on('message', function (json) {
        console.log("Received unknown message from master", JSON.stringify(json))
    });

    let hashtable = new HashTable();
    let promiseList = [];
    for (let ix = 0; ix < 100; ix++) {
        promiseList.push(
            new Promise(function (resolve, reject) {
                let record = {
                    "pk": returnHash()
                };

                let privateKey = new Buffer(record.pk, 'hex');
                record.wif = wif.encode(128, privateKey, true);

                let ck = CoinKey.fromWif(record.wif);
                record.wallet = ck.publicAddress;

                resolve(record);
            })
                .then(function (record) {
                    return rp('https://blockchain.info/q/addressbalance/' + record.wallet)
                        .then(function (htmlString) {

                            hashtable.put(record.wallet, +(htmlString));

                            if (+(htmlString) > 0) {
                                console.log("Found!", JSON.stringify(record));

                                process.send(
                                    {
                                        "type": "hit",
                                        "data": {
                                            "wallet": record.wallet,
                                            "wif": record.wif,
                                            "balance": +(htmlString)
                                        }
                                    });
                            } else {
                                // console.log("No balance on ", record.wallet)
                            }
                        })
                        .catch(function (err) {
                            console.error(err);
                        });
                })
        );

    }
    Promise.all(promiseList)
        .then(function () {
            _.each(hashtable.keys(), function (key) {
                console.log(key, hashtable.get(key))
            });
            console.log("DONE");
            process.exit()
        });
};