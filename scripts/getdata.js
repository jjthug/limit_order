const { GelatoOpsSDK, isGelatoOpsSupported, TaskTransaction } = require( "@gelatonetwork/ops-sdk");
const gelatoOps = new GelatoOpsSDK(chainId, signer);
gelatoOps.getActiveTasks()