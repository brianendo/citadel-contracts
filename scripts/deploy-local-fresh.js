const hre = require("hardhat");
const ethers = hre.ethers;
const getContractFactories = require("./utils/getContractFactories");
const deployContracts = require("./utils/deployContracts");
const getRoleSigners = require("./utils/getRoleSingers");
const { address, hashIt } = require("./utils/helpers");
const grantRoles = require("./utils/grantRoles");

const wbtc_address = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599";
const cvx_address = "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b";

async function main() {
  const signers = await ethers.getSigners();

  /// === Contract Factories

  const {
    GlobalAccessControl,
    CitadelToken,
    StakedCitadelVester,
    StakedCitadel,
    StakedCitadelLocker,
    SupplySchedule,
    CitadelMinter,
    KnightingRound,
    Funding,
    ERC20Upgradeable,
    KnightingRoundGuestlist,
  } = await getContractFactories();

  /// === Deploying Contracts & loggin addresses

  const {
    gac,
    citadel,
    xCitadel,
    xCitadelVester,
    xCitadelLocker,
    schedule,
    citadelMinter,
    knightingRound,
    knightingRoundGuestlist,
    fundingWbtc,
    fundingCvx,
  } = await deployContracts([
    { factory: GlobalAccessControl, instance: "gac" },
    { factory: CitadelToken, instance: "citadel" },
    { factory: StakedCitadel, instance: "xCitadel" },
    { factory: StakedCitadelVester, instance: "xCitadelVester" },
    { factory: StakedCitadelLocker, instance: "xCitadelLocker" },
    { factory: SupplySchedule, instance: "schedule" },
    { factory: CitadelMinter, instance: "citadelMinter" },
    { factory: KnightingRound, instance: "knightingRound" },
    { factory: KnightingRoundGuestlist, instance: "knightingRoundGuestlist" },
    { factory: Funding, instance: "fundingWbtc" },
    { factory: Funding, instance: "fundingCvx" },
  ]);

  const wbtc = ERC20Upgradeable.attach(wbtc_address); //
  const cvx = ERC20Upgradeable.attach(cvx_address); //

  /// === Variable Setup
  const {
    governance,
    keeper,
    guardian,
    treasuryVault,
    techOps,
    treasuryOps,
    citadelTree,
    policyOps,
    eoaOracle,
  } = await getRoleSigners();

  /// === Initialization and Setup

  /// ======= Global Access Control

  console.log(governance);
  console.log(governance.address);

  console.log("Initialize GAC...");
  await gac.connect(governance).initialize(governance.address);

  /// ======= Citadel Token

  console.log("Initialize Citadel Token...");
  await citadel.connect(governance).initialize("Citadel", "CTDL", gac.address);

  /// ======= Staked (x) Citadel Vault Token

  console.log("Initialize xCitadel Token...");

  const xCitadelFees = [0, 0, 0, 0];

  await xCitadel
    .connect(governance)
    .initialize(
      address(citadel),
      address(governance),
      address(keeper),
      address(guardian),
      address(treasuryVault),
      address(techOps),
      address(citadelTree),
      address(xCitadelVester),
      "Staked Citadel",
      "xCTDL",
      xCitadelFees
    );

  /// ======= Vested Exit | xCitadelVester
  console.log("Initialize xCitadelVester...");
  await xCitadelVester
    .connect(governance)
    .initialize(address(gac), address(citadel), address(xCitadel));

  /// =======  xCitadelLocker
  console.log("Initialize xCitadelLocker...");
  await xCitadelLocker
    .connect(governance)
    .initialize(address(xCitadel), "Vote Locked xCitadel", "vlCTDL");
  // add reward token to be distributed to staker
  await xCitadelLocker
    .connect(governance)
    .addReward(address(xCitadel), address(citadelMinter), true);

  // ========  SupplySchedule || CTDL Token Distribution
  console.log("Initialize supplySchedule...");
  await schedule.connect(governance).initialize(address(gac));

  // ========  CitadelMinter || CTDLMinter
  console.log("Initialize citadelMinter...");
  await citadelMinter
    .connect(governance)
    .initialize(
      address(gac),
      address(citadel),
      address(xCitadel),
      address(xCitadelLocker),
      address(schedule)
    );

  console.log("Initialize knightingRoundGuestlist...");
  // knightingRoundGuestlist.connect(governance).initialize(address(gac));
  // knightingRoundGuestlist.connect(techOps).setGuestRoot("0xa792f206b3e190ce3670653ece23b5ffac811e402f37d3c6d37638e310c2b081");

  /// ========  Knighting Round
  const knightingRoundParams = {
    start: ethers.BigNumber.from(
      ((new Date().getTime() + 1000 * 1000) / 1000).toPrecision(10).toString()
    ),
    duration: ethers.BigNumber.from(14 * 24 * 3600),
    citadelWbtcPrice: ethers.utils.parseUnits("21", 18), // 21 CTDL per wBTC
    wbtcLimit: ethers.utils.parseUnits("100", 8), // 100 wBTC
  };

  console.log(
    knightingRoundParams.start,
    knightingRoundParams.duration,
    knightingRoundParams.citadelWbtcPrice,
    knightingRoundParams.wbtcLimit
  );

  console.log("Initialize knightingRound...");
  // TODO: need to deploy a guest list contract, address 0 won't run
  await knightingRound.connect(governance).initialize(
    address(gac),
    address(citadel),
    address(wbtc),
    knightingRoundParams.start,
    knightingRoundParams.duration,
    knightingRoundParams.citadelWbtcPrice,
    address(treasuryVault),
    address(knightingRoundGuestlist), // TODO: Add guest list and test with it
    knightingRoundParams.wbtcLimit
  );

  // /// ========  Funding
  console.log("Initialize funding...");
  await fundingWbtc.initialize(
    address(gac),
    address(citadel),
    address(wbtc),
    address(xCitadel),
    address(treasuryVault),
    address(eoaOracle),
    ethers.utils.parseUnits("100", 8)
  );
  await fundingCvx.initialize(
    address(gac),
    address(citadel),
    address(cvx),
    address(xCitadel),
    address(treasuryVault),
    address(eoaOracle),
    ethers.utils.parseUnits("100000", 18)
  );

  /// ======== Grant roles
  await grantRoles(gac, governance, getRoleSigners);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
