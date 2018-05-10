# Zixxified dependency

This version of node-stratum-pool is modified to work with the [Zixx coin](https://www.zixx.org). 

See the commit : https://github.com/zixxcrypto/zixx-node-stratum-pool/commit/138c4407dc9de5644ab3e0b7fc04e09687053564

If you want to implement this change in your own pool but don't want to use this dependency, here is the change you need to make (adapted to your pool) :

```javascript
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
  ```

---

For any issues regarding this implementation, you can :
- Join us on Discord ([zixx.chat](http://zixx.chat)),
- Email the Zixx developers : dev[at]zixx.org,
- Open an issue on this repo.

---


High performance Stratum poolserver in Node.js for [NOMP (Node Open Mining Portal)](https://github.com/foxer666/node-open-mining-portal)


Current version: v1.0.8
