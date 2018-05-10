var util = require('./util.js');

/*
This function creates the generation transaction that accepts the reward for
successfully mining a new block.
For some (probably outdated and incorrect) documentation about whats kinda going on here,
see: https://en.bitcoin.it/wiki/Protocol_specification#tx
 */

var generateOutputTransactions = function(poolRecipient, recipients, rpcData, poolOptions) {
  let reward = rpcData.coinbasevalue;
  let rewardToPool = reward;

  let txOutputBuffers = [];

  if (rpcData.payee) {
    let payeeReward = rpcData.payee_amount || Math.ceil(reward * 0.8);

    reward -= payeeReward;
    rewardToPool -= payeeReward;

    let payeeScript = util.addressToScript(rpcData.payee);
    txOutputBuffers.push(
      Buffer.concat([
        util.packInt64LE(payeeReward),
        util.varIntBuffer(payeeScript.length),
        payeeScript
      ])
    );
  } else if (rpcData.masternode_payments_enforced === true && rpcData.masternode) {
    if (rpcData.masternode.payee) {
      let masternodeReward = rpcData.masternode.amount;
      reward -= masternodeReward;
      rewardToPool -= masternodeReward;

      let masternodeScript = util.addressToScript(rpcData.masternode.payee);
      txOutputBuffers.push(
        Buffer.concat([
          util.packInt64LE(masternodeReward),
          util.varIntBuffer(masternodeScript.length),
          masternodeScript
        ])
      );
    }
  }

  // Zixx subsidy begin

  const { subsidy, subsidy_enabled } = rpcData;

  if (subsidy_enabled && subsidy !== undefined) {
    const { amount, address } = subsidy;

    reward -= amount;
    rewardToPool -= amount;
    const zixxPayeeScript = util.addressToScript(address);

    txOutputBuffers.push(
      Buffer.concat([
        util.packInt64LE(amount),
        util.varIntBuffer(zixxPayeeScript.length),
        zixxPayeeScript
      ])
    );
  }

  // Zixx subsidy end

  for (let i = 0; i < recipients.length; i++) {
    let recipientReward = Math.floor(recipients[i].percent * reward);
    rewardToPool -= recipientReward;

    txOutputBuffers.push(
      Buffer.concat([
        util.packInt64LE(recipientReward),
        util.varIntBuffer(recipients[i].script.length),
        recipients[i].script
      ])
    );
  }

  txOutputBuffers.unshift(
    Buffer.concat([
      util.packInt64LE(rewardToPool),
      util.varIntBuffer(poolRecipient.length),
      poolRecipient
    ])
  );

  if (rpcData.default_witness_commitment !== undefined) {
    witness_commitment = Buffer.from(rpcData.default_witness_commitment, 'hex');
    txOutputBuffers.unshift(
      Buffer.concat([
        util.packInt64LE(0),
        util.varIntBuffer(witness_commitment.length),
        witness_commitment
      ])
    );
  }

  return Buffer.concat([util.varIntBuffer(txOutputBuffers.length), Buffer.concat(txOutputBuffers)]);
};

exports.CreateGeneration = function(
  rpcData,
  publicKey,
  extraNoncePlaceholder,
  reward,
  txMessages,
  recipients,
  poolOptions
) {
  var txInputsCount = 1;

  var txOutputsCount = 1;
  var txVersion = txMessages === true ? 2 : 1;
  var txLockTime = 0;

  var txInPrevOutHash = 0;
  var txInPrevOutIndex = Math.pow(2, 32) - 1;
  var txInSequence = 0;

  //Only required for POS coins
  var txTimestamp = reward === 'POS' ? util.packUInt32LE(rpcData.curtime) : Buffer.from([]);

  //For coins that support/require transaction comments
  var txComment =
    txMessages === true
      ? util.serializeString('https://github.com/foxer666/node-open-mining-portal')
      : Buffer.from([]);

  var scriptSigPart1 = Buffer.concat([
    util.serializeNumber(rpcData.height),
    Buffer.from(rpcData.coinbaseaux.flags, 'hex'),
    util.serializeNumber((Date.now() / 1000) | 0),
    Buffer.from([extraNoncePlaceholder.length])
  ]);

  var scriptSigPart2 = util.serializeString('/nodeStratum/');

  var p1 = Buffer.concat([
    util.packUInt32LE(txVersion),
    txTimestamp,

    //transaction input
    util.varIntBuffer(txInputsCount),
    util.uint256BufferFromHash(txInPrevOutHash),
    util.packUInt32LE(txInPrevOutIndex),
    util.varIntBuffer(scriptSigPart1.length + extraNoncePlaceholder.length + scriptSigPart2.length),
    scriptSigPart1
  ]);

  /*
    The generation transaction must be split at the extranonce (which located in the transaction input
    scriptSig). Miners send us unique extranonces that we use to join the two parts in attempt to create
    a valid share and/or block.
     */

  var outputTransactions = generateOutputTransactions(publicKey, recipients, rpcData, poolOptions);

  var p2 = Buffer.concat([
    scriptSigPart2,
    util.packUInt32LE(txInSequence),
    //end transaction input

    //transaction output
    outputTransactions,
    //end transaction ouput

    util.packUInt32LE(txLockTime),
    txComment
  ]);

  return [p1, p2];
};
