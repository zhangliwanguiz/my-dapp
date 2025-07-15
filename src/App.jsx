import { useState, useEffect } from "react";
import { ethers } from "ethers";
import './App.css'; // 导入 App.css 文件

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

// 自定义消息框组件
const MessageBox = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="message-box-overlay">
      <div className="message-box-content">
        <p>{message}</p>
        <button onClick={onClose} className="message-box-button">确定</button>
      </div>
    </div>
  );
};

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
  const [message, setMessage] = useState(""); // 用于显示自定义消息
  const [activeTab, setActiveTab] = useState("swap"); // 'swap' or 'pool'

  // 连接钱包
  const connectWallet = async () => {
    if (!window.ethereum) {
      setMessage("请安装 MetaMask！");
      return;
    }
    try {
      const _provider = new ethers.providers.Web3Provider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);
      const _signer = _provider.getSigner();
      const address = await _signer.getAddress();

      setProvider(_provider);
      setSigner(_signer);
      setWalletAddress(address);
    } catch (e) {
      setMessage("连接钱包失败：" + e.message);
    }
  };

  // 查询代币余额和价格
  const fetchBalancesAndPrices = async () => {
    if (!walletAddress || !provider) return;

    try {
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
    } catch (e) {
      setMessage("获取余额或价格失败：" + e.message);
    }
  };

  // 授权检查并自动approve
  const approveIfNeeded = async (tokenAddress, amount) => {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const allowance = await token.allowance(walletAddress, TOKENSWAP_ADDRESS);
    if (allowance.lt(amount)) {
      setMessage("需要授权，请在MetaMask中确认...");
      const tx = await token.approve(TOKENSWAP_ADDRESS, amount);
      await tx.wait();
      setMessage("授权成功！");
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
    if (!walletAddress || !ctkInput || isNaN(ctkInput) || parseFloat(ctkInput) <= 0) {
      setMessage("请输入有效的CTK数量！");
      return;
    }
    setIsSwapping(true);
    try {
      const ctk = new ethers.Contract(CTK_ADDRESS, ERC20_ABI, signer);
      const decimals = await ctk.decimals();
      const amount = ethers.utils.parseUnits(ctkInput, decimals);

      await approveIfNeeded(CTK_ADDRESS, amount);

      const tokenSwap = new ethers.Contract(TOKENSWAP_ADDRESS, TOKENSWAP_ABI, signer);
      setMessage("正在兑换CTK → CTK2，请在MetaMask中确认...");
      const tx = await tokenSwap.swapAToB(amount);
      await tx.wait();

      setMessage("CTK → CTK2 兑换成功！");
      setCtkInput("");
      fetchBalancesAndPrices();
    } catch (e) {
      setMessage("兑换失败：" + e.message);
    }
    setIsSwapping(false);
  };

  // CTK2 -> CTK 兑换
  const swapCtk2ToCtk = async () => {
    if (!walletAddress || !ctk2Input || isNaN(ctk2Input) || parseFloat(ctk2Input) <= 0) {
      setMessage("请输入有效的CTK2数量！");
      return;
    }
    setIsReverseSwapping(true);
    try {
      const ctk2 = new ethers.Contract(CTK2_ADDRESS, ERC20_ABI, signer);
      const decimals = await ctk2.decimals();
      const amount = ethers.utils.parseUnits(ctk2Input, decimals);

      await approveIfNeeded(CTK2_ADDRESS, amount);

      const tokenSwap = new ethers.Contract(TOKENSWAP_ADDRESS, TOKENSWAP_ABI, signer);
      setMessage("正在兑换CTK2 → CTK，请在MetaMask中确认...");
      const tx = await tokenSwap.swapBToA(amount);
      await tx.wait();

      setMessage("CTK2 → CTK 兑换成功！");
      setCtk2Input("");
      fetchBalancesAndPrices();
    } catch (e) {
      setMessage("兑换失败：" + e.message);
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
      isNaN(liquidityCtk2) ||
      parseFloat(liquidityCtk) <= 0 ||
      parseFloat(liquidityCtk2) <= 0
    ) {
      setMessage("请输入有效的CTK和CTK2数量！");
      return;
    }

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
      setMessage("正在添加流动性，请在MetaMask中确认...");
      const tx = await tokenSwap.addLiquidity(amountA, amountB);
      await tx.wait();

      setMessage("添加流动性成功！");
      setLiquidityCtk("");
      setLiquidityCtk2("");
      fetchBalancesAndPrices();
    } catch (e) {
      setMessage("添加流动性失败：" + e.message);
    }
    setIsAddingLiquidity(false);
  };

  useEffect(() => {
    if (walletAddress) {
      fetchBalancesAndPrices();
    }
  }, [walletAddress, provider]); // 依赖中添加provider，确保provider初始化后再获取余额和价格

  return (
    <div className="app-wrapper"> {/* 新增一个最外层包裹器 */}
      <MessageBox message={message} onClose={() => setMessage("")} /> {/* 自定义消息框 */}

      <header className="navbar">
        <div className="navbar-left">
          <div className="logo">
            <span role="img" aria-label="unicorn">🦄</span> {/* 简单的logo图标 */}
          </div>
          <nav>
            <button className={`nav-item ${activeTab === 'swap' ? 'active' : ''}`} onClick={() => setActiveTab('swap')}>
              交易
            </button>
            <button className={`nav-item ${activeTab === 'pool' ? 'active' : ''}`} onClick={() => setActiveTab('pool')}>
              资金池
            </button>
            {/* <button className="nav-item">探索</button> */} {/* 暂时不实现，可以作为未来功能 */}
          </nav>
        </div>
        <div className="navbar-right">
          {walletAddress ? (
            <div className="wallet-connected">
              <span className="wallet-address-display">
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </span>
              <span className="wallet-status-dot"></span> {/* 连接状态小圆点 */}
            </div>
          ) : (
            <button onClick={connectWallet} className="connect-wallet-button">
              连接钱包
            </button>
          )}
        </div>
      </header>

      <div className="main-content">
        {activeTab === 'swap' && (
          <div className="container">
            <div className="swap-card">
              <div className="swap-header">
                <h3>兑换</h3>
                {/* 设置图标，暂时不实现功能 */}
                <span className="settings-icon" role="img" aria-label="settings">⚙️</span>
              </div>

              <div className="input-section">
                <div className="input-row">
                  <input
                    type="number"
                    placeholder="0"
                    value={ctkInput}
                    onChange={(e) => setCtkInput(e.target.value)}
                    className="swap-input-field"
                  />
                  <button className="token-select-button">
                    CTK <span className="dropdown-arrow">▼</span>
                  </button>
                </div>
                <p className="usd-value">US$0</p> {/* 模拟美元价值 */}
              </div>

              <div className="swap-arrow-container">
                <button className="swap-arrow-button">↓</button>
              </div>

              <div className="input-section">
                <div className="input-row">
                  <input
                    type="number"
                    placeholder="0"
                    value={ctk2Input}
                    onChange={(e) => setCtk2Input(e.target.value)}
                    className="swap-input-field"
                  />
                  <button className="token-select-button">
                    CTK2 <span className="dropdown-arrow">▼</span>
                  </button>
                </div>
                <p className="usd-value">预估可获得 CTK: {ctkEstimate}</p> {/* 这里显示反向兑换的估算 */}
              </div>

              <button onClick={swapCtkToCtk2} disabled={isSwapping || !walletAddress || parseFloat(ctkInput) <= 0} className="swap-button">
                {isSwapping ? "兑换中..." : (walletAddress ? "兑换" : "连接钱包")}
              </button>
              {walletAddress && <button onClick={swapCtk2ToCtk} disabled={isReverseSwapping || parseFloat(ctk2Input) <= 0} className="swap-button secondary-swap-button">
                {isReverseSwapping ? "反向兑换中..." : "反向兑换"}
              </button>}
            </div>
          </div>
        )}

        {activeTab === 'pool' && (
          <div className="container">
            <div className="pool-card">
              <h3>添加流动性</h3>
              <div className="input-section">
                <div className="input-row">
                  <input
                    type="number"
                    placeholder="输入添加的 CTK 数量"
                    value={liquidityCtk}
                    onChange={(e) => setLiquidityCtk(e.target.value)}
                    className="input-field"
                  />
                  <button className="token-select-button">
                    CTK <span className="dropdown-arrow">▼</span>
                  </button>
                </div>
              </div>
              <div className="input-section">
                <div className="input-row">
                  <input
                    type="number"
                    placeholder="输入添加的 CTK2 数量"
                    value={liquidityCtk2}
                    onChange={(e) => setLiquidityCtk2(e.target.value)}
                    className="input-field"
                  />
                  <button className="token-select-button">
                    CTK2 <span className="dropdown-arrow">▼</span>
                  </button>
                </div>
              </div>
              <button onClick={addLiquidity} disabled={isAddingLiquidity || !walletAddress || parseFloat(liquidityCtk) <= 0 || parseFloat(liquidityCtk2) <= 0} className="action-button">
                {isAddingLiquidity ? "添加中..." : (walletAddress ? "添加流动性" : "连接钱包")}
              </button>
            </div>
            {/* 可以在这里添加显示用户现有流动性的区域 */}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
