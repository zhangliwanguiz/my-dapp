import { useState, useEffect } from "react";
import { ethers } from "ethers";

// 合约地址
const TOKENSWAP_ADDRESS = "0x86FEDc7357c8D063771Db2d6D703d5Fa5b2a37F1";
const CTK_ADDRESS = "0xf77a5862DE9FcFAA9101eF433557C36D4Bfa2361";
const CTK2_ADDRESS = "0x395f16d2567ca9b1D3A078bCb6C0dfE4C2Bf8E4C";

// 合约ABI，简化版，只包含需要调用的函数
const TOKENSWAP_ABI = [
  "function swapAToB(uint256 amountAIn) external",
  "function swapBToA(uint256 amountBIn) external",
  "function getPriceAtoB() external view returns (uint256)",
  "function getPriceBtoA() external view returns (uint256)",
  "function addLiquidity(uint256 amountA, uint256 amountB) external",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [ctkBalance, setCtkBalance] = useState("");
  const [ctk2Balance, setCtk2Balance] = useState("");
  const [ctkInput, setCtkInput] = useState("");
  const [ctk2Input, setCtk2Input] = useState("");
  const [ctk2Estimate, setCtk2Estimate] = useState("?");
  const [ctkEstimate, setCtkEstimate] = useState("?");
  const [priceAtoB, setPriceAtoB] = useState("?");
  const [priceBtoA, setPriceBtoA] = useState("?");
  const [isSwapping, setIsSwapping] = useState(false);
  const [isReverseSwapping, setIsReverseSwapping] = useState(false);
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [liquidityCtk, setLiquidityCtk] = useState("");
  const [liquidityCtk2, setLiquidityCtk2] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  // 连接钱包
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("请安装 MetaMask！");
      return;
    }
    const _provider = new ethers.providers.Web3Provider(window.ethereum);
    await _provider.send("eth_requestAccounts", []);
    const _signer = _provider.getSigner();
    const address = await _signer.getAddress();

    setProvider(_provider);
    setSigner(_signer);
    setWalletAddress(address);
  };

  // 查询代币余额和价格
  const fetchBalancesAndPrices = async () => {
    if (!walletAddress || !provider) return;

    // CTK
    const ctk = new ethers.Contract(CTK_ADDRESS, ERC20_ABI, provider);
    const decimalsA = await ctk.decimals();
    const rawA = await ctk.balanceOf(walletAddress);
    setCtkBalance(ethers.utils.formatUnits(rawA, decimalsA));

    // CTK2
    const ctk2 = new ethers.Contract(CTK2_ADDRESS, ERC20_ABI, provider);
    const decimalsB = await ctk2.decimals();
    const rawB = await ctk2.balanceOf(walletAddress);
    setCtk2Balance(ethers.utils.formatUnits(rawB, decimalsB));

    // TokenSwap 合约价格
    const tokenSwap = new ethers.Contract(TOKENSWAP_ADDRESS, TOKENSWAP_ABI, provider);
    const priceABRaw = await tokenSwap.getPriceAtoB();
    const priceBARaw = await tokenSwap.getPriceBtoA();

    setPriceAtoB(ethers.utils.formatUnits(priceABRaw, 18));
    setPriceBtoA(ethers.utils.formatUnits(priceBARaw, 18));
  };

  // 授权检查并自动approve
  const approveIfNeeded = async (tokenAddress, amount) => {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const allowance = await token.allowance(walletAddress, TOKENSWAP_ADDRESS);
    if (allowance.lt(amount)) {
      const tx = await token.approve(TOKENSWAP_ADDRESS, amount);
      await tx.wait();
    }
  };

  // 估算 CTK -> CTK2 输出数量
  useEffect(() => {
    if (!priceAtoB || isNaN(ctkInput) || ctkInput === "") {
      setCtk2Estimate("?");
      return;
    }
    setCtk2Estimate((parseFloat(ctkInput) * parseFloat(priceAtoB)).toFixed(6));
  }, [ctkInput, priceAtoB]);

  // 估算 CTK2 -> CTK 输出数量
  useEffect(() => {
    if (!priceBtoA || isNaN(ctk2Input) || ctk2Input === "") {
      setCtkEstimate("?");
      return;
    }
    setCtkEstimate((parseFloat(ctk2Input) * parseFloat(priceBtoA)).toFixed(6));
  }, [ctk2Input, priceBtoA]);

  // CTK -> CTK2 兑换
  const swapCtkToCtk2 = async () => {
    if (!walletAddress || !ctkInput || isNaN(ctkInput)) return;
    setIsSwapping(true);
    try {
      const ctk = new ethers.Contract(CTK_ADDRESS, ERC20_ABI, signer);
      const decimals = await ctk.decimals();
      const amount = ethers.utils.parseUnits(ctkInput, decimals);

      await approveIfNeeded(CTK_ADDRESS, amount);

      const tokenSwap = new ethers.Contract(TOKENSWAP_ADDRESS, TOKENSWAP_ABI, signer);
      const tx = await tokenSwap.swapAToB(amount);
      await tx.wait();

      alert("CTK → CTK2 兑换成功！");
      setCtkInput("");
      fetchBalancesAndPrices();
    } catch (e) {
      alert("兑换失败：" + e.message);
    }
    setIsSwapping(false);
  };

  // CTK2 -> CTK 兑换
  const swapCtk2ToCtk = async () => {
    if (!walletAddress || !ctk2Input || isNaN(ctk2Input)) return;
    alert(ctk2Input);
    setIsReverseSwapping(true);
    try {
      const ctk2 = new ethers.Contract(CTK2_ADDRESS, ERC20_ABI, signer);
      const decimals = await ctk2.decimals();
      const amount = ethers.utils.parseUnits(ctk2Input, decimals);
alert(amount);
      await approveIfNeeded(CTK2_ADDRESS, amount);

      const tokenSwap = new ethers.Contract(TOKENSWAP_ADDRESS, TOKENSWAP_ABI, signer);
      const tx = await tokenSwap.swapBToA(amount);
      await tx.wait();

      alert("CTK2 → CTK 兑换成功！");
      setCtk2Input("");
      fetchBalancesAndPrices();
    } catch (e) {
      alert("兑换失败：" + e.message);
    }
    setIsReverseSwapping(false);
  };

  // 添加流动性
  const addLiquidity = async () => {
    if (
      !walletAddress ||
      !liquidityCtk ||
      !liquidityCtk2 ||
      isNaN(liquidityCtk) ||
      isNaN(liquidityCtk2)
    )
      return;

    setIsAddingLiquidity(true);
    try {
      const ctk = new ethers.Contract(CTK_ADDRESS, ERC20_ABI, signer);
      const ctk2 = new ethers.Contract(CTK2_ADDRESS, ERC20_ABI, signer);

      const decimalsA = await ctk.decimals();
      const decimalsB = await ctk2.decimals();

      const amountA = ethers.utils.parseUnits(liquidityCtk, decimalsA);
      const amountB = ethers.utils.parseUnits(liquidityCtk2, decimalsB);

      // 授权
      await approveIfNeeded(CTK_ADDRESS, amountA);
      await approveIfNeeded(CTK2_ADDRESS, amountB);

      const tokenSwap = new ethers.Contract(TOKENSWAP_ADDRESS, TOKENSWAP_ABI, signer);
      const tx = await tokenSwap.addLiquidity(amountA, amountB);
      await tx.wait();

      alert("添加流动性成功！");
      setLiquidityCtk("");
      setLiquidityCtk2("");
      fetchBalancesAndPrices();
    } catch (e) {
      alert("添加流动性失败：" + e.message);
    }
    setIsAddingLiquidity(false);
  };

  useEffect(() => {
    if (walletAddress) {
      fetchBalancesAndPrices();
    }
  }, [walletAddress]);

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", maxWidth: 400, margin: "auto" }}>
      {!walletAddress ? (
        <button onClick={connectWallet} style={{ padding: "1rem", width: "100%" }}>
          连接 MetaMask
        </button>
      ) : (
        <>
          <p>钱包地址: {walletAddress}</p>
          <p>CTK 余额: {ctkBalance}</p>
          <p>CTK2 余额: {ctk2Balance}</p>

          <hr />

          <h3>添加流动性</h3>
          <input
            type="number"
            placeholder="输入添加的 CTK 数量"
            value={liquidityCtk}
            onChange={(e) => setLiquidityCtk(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
          />
          <input
            type="number"
            placeholder="输入添加的 CTK2 数量"
            value={liquidityCtk2}
            onChange={(e) => setLiquidityCtk2(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
          />
          <button onClick={addLiquidity} disabled={isAddingLiquidity} style={{ width: "100%" }}>
            {isAddingLiquidity ? "添加中..." : "添加流动性"}
          </button>

          <hr />

          <h3>兑换 CTK → CTK2</h3>
          <input
            type="number"
            placeholder="输入 CTK 数量"
            value={ctkInput}
            onChange={(e) => setCtkInput(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
          />
          <p>预估可获得 CTK2: {ctk2Estimate}</p>
          <button onClick={swapCtkToCtk2} disabled={isSwapping} style={{ width: "100%" }}>
            {isSwapping ? "兑换中..." : "兑换 CTK→CTK2"}
          </button>

          <hr />

          <h3>兑换 CTK2 → CTK</h3>
          <input
            type="number"
            placeholder="输入 CTK2 数量"
            value={ctk2Input}
            onChange={(e) => setCtk2Input(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
          />
          <p>预估可获得 CTK: {ctkEstimate}</p>
          <button onClick={swapCtk2ToCtk} disabled={isReverseSwapping} style={{ width: "100%" }}>
            {isReverseSwapping ? "兑换中..." : "兑换 CTK2→CTK"}
          </button>
        </>
      )}
    </div>
  );
}

export default App;
