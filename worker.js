const CoinKey = require('coinkey');
const axios = require('axios');
const Promise = require('bluebird');

const _ = require('lodash');
const wif = require('wif');

const TEST_KEY = '0000000000000000000000000000000000000000000000000000000000000001';
const TEST_ADDRESS = "1JCe8z4jJVNXSjohjM4i9Hh813dLCNx2Sy";

const BALANCE_API_URL = "http://localhost:3000/";

const returnHash = function () {
    abc = "abcdef1234567890".split("");
    let token = "";
    for (i = 0; i < 64; i++) {
        token += abc[Math.floor(Math.random() * abc.length)];
    }
    return token; //Will return a 32 bit "hash"
};

let addresses =0, pristine =0, hit=0, dirty = 0;

module.exports.doProcess = function () {
    process.on('message', function (json) {
        console.log("Received unknown message from master", JSON.stringify(json))
    });

    let promiseList = [];
    for (let ix = 0; ix < 1000; ix++) {
        promiseList.push(
            new Promise(async (resolve, reject) => {
                let record = {
                    "pk": returnHash()
                };

                let privateKey = Buffer.alloc(record.pk.length / 2, record.pk, 'hex');
                record.wif = wif.encode(128, privateKey, true);


                let ck = CoinKey.fromWif(record.wif);
                record.wallet = ck.publicAddress;

                addresses++;

                // Check with our balance database first
                const balanceDbResp = await axios.get(BALANCE_API_URL, {params: {query: record.wallet}});
                const balanceDetail = balanceDbResp.data;
                if (balanceDetail.found === true) {
                    console.log("Balance found, enriching details " + record.wallet + " " + record.wif);
                    // Enrich with real detail
                    const blockchainResp = await axios.get('https://blockchain.info/multiaddr', {
                        params: {
                            cors: true,
                            active: record.wallet
                        }
                    });

                    const walletDetail = blockchainResp.data;

                    if (walletDetail.balance > 0) {
                        console.log("Found!", JSON.stringify(record));
                        hit++;
                        process.send(
                            {
                                "type": "hit",
                                "data": {
                                    "wallet": record.wallet,
                                    "wif": record.wif,
                                    "balance": walletDetail.wallet.final_balance
                                }
                            });
                        resolve(true);
                    } else {
                        if (walletDetail.total_received > 0) {
                            // Used before
                            console.log("Interesting!", JSON.stringify(record));
                            dirty++;
                            process.send(
                                {
                                    "type": "dirty",
                                    "data": {
                                        "wallet": record.wallet,
                                        "wif": record.wif,
                                        "balance": walletDetail.wallet.final_balance
                                    }
                                });
                            resolve(false);

                        } else {
                            // Pristine wallet
                            pristine++;
                            // console.log("Pristine wallet ", record.wallet)
                            resolve(false);

                        }
                    }
                } else
                    resolve(false);
            })
        );

    }
    Promise.all(promiseList)
        .then( () => {
            process.send(
                {
                    "type": "stats",
                    "data": {
                        "addresses": addresses,
                        "hit": hit,
                        "dirty": dirty,
                        "pristine": pristine
                    }
                });

            process.exit()
        });
};
