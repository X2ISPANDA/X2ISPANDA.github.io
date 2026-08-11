'use strict'
/* 控制台输出字符画 start */
var now1 = new Date();

function createtime1() {
  var grt = new Date("03/01/2023 00:00:00"); //此处修改你的建站时间或者网站上线时间
  now1.setTime(now1.getTime() + 250);
  var days = (now1 - grt) / 1000 / 60 / 60 / 24;
  var dnum = Math.floor(days);

  var ascll = [
    `欢迎来到LrcShare!`,
    `全球最小滚动歌词分享网站 🎵🎵🎵`,
    `   
    ██╗     ██████╗  ██████╗███████╗██╗  ██╗ █████╗ ██████╗ ███████╗
    ██║     ██╔══██╗██╔════╝██╔════╝██║  ██║██╔══██╗██╔══██╗██╔════╝
    ██║     ██████╔╝██║     ███████╗███████║███████║██████╔╝█████╗  
    ██║     ██╔══██╗██║     ╚════██║██╔══██║██╔══██║██╔══██╗██╔══╝  
    ███████╗██║  ██║╚██████╗███████║██║  ██║██║  ██║██║  ██║███████╗
    ╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝                                                                                                                                                                                                                                            
`,
    "本站已经",
    dnum,
    "天啦!",
    "我爱九维哥",
    "©2023 By X2ISPANDA",
  ];

  setTimeout(
    console.log.bind(
      console,
      `\n%c${ascll[0]} %c ${ascll[1]} %c ${ascll[2]} %c${ascll[3]}%c ${ascll[4]}%c ${ascll[5]}\n\n%c ${ascll[6]}\n ${ascll[7]}`,
      "color:#39c5bb",
      "",
      "color:#39c5bb",
      "color:#39c5bb",
      "",
      "color:#39c5bb",
      ""
    )
  );
}

createtime1();

function createtime2() {
  var ascll2 = [`NCC2-036`, `调用前置摄像头拍照成功，识别为「大聪明」`, `Photo captured: `, ` 🤪 `];

  setTimeout(
    console.log.bind(
      console,
      `%c ${ascll2[0]} %c ${ascll2[1]} %c \n${ascll2[2]} %c\n${ascll2[3]}`,
      "color:white; background-color:#10bcc0",
      "",
      "",
      'background:url("https://unpkg.zhimg.com/anzhiyu-assets@latest/image/common/tinggge.gif") no-repeat;font-size:450%'
    )
  );

  setTimeout(console.log.bind(console, "%c WELCOME %c 欢迎光临，大聪明", "color:white; background-color:#23c682", ""));

  setTimeout(
    console.warn.bind(
      console,
      "%c ⚡ Powered by X2ISPANDA %c 你正在访问LrcShare",
      "color:white; background-color:#f0ad4e",
      ""
    )
  );

  setTimeout(console.log.bind(console, "%c W23-12 %c 系统监测到你已打开控制台", "color:white; background-color:#4f90d9", ""));
  setTimeout(
    console.warn.bind(console, "%c S013-782 %c 你现在正处于监控中", "color:white; background-color:#d9534f", "")
  );
}
createtime2();
/* 控制台输出字符画 end */


const label = document.querySelector('.reward-button')
let clicks = 0;
if(label!=null){
  label.addEventListener('click', function () {
    clicks = clicks+1;
    // console.log("点击事件")
    if (clicks == 9) {
      // 处理点击事件
      let str = window.location.href
      str = str.substring(0, str.length - 2);
      window.open(str)
    }
})
}


function reward(){
  Swal.fire({
    title: '<strong>您正在为 <u>LrcShare</u> 充电</strong>',
    html: '<b>请选择您的付款方式</b>',
    icon: 'info',
    showCancelButton: true,
    confirmButtonText:
      '<i class="fa-brands fa-alipay"></i> 支付宝',
    cancelButtonText:
      '<i class="fa-brands fa-weixin"></i> 微信支付',
    confirmButtonColor: '#1677FF',
    cancelButtonColor: '#2AAE67',
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: '感谢您',
        html: '请打开支付宝 <b>[扫一扫]</b> 以充电',
        imageUrl: '/img/Alipay.jpg',
        imageWidth: 175,
        imageHeight: 175,
        imageAlt: 'Custom image'
      }).then((result) => {
        Swal.fire(
          'LrcShare',
          '感谢您的支持',
          'success'
        )
      })
    } else if (
      result.dismiss === Swal.DismissReason.cancel
    ) {
      Swal.fire({
        title: '感谢您',
        html: '请打开微信 <b>[扫一扫]</b> 以充电',
        imageUrl: '/img/Wechat.jpg',
        imageWidth: 175,
        imageHeight: 175,
        imageAlt: 'Custom image'
      }).then((result) => {
        Swal.fire(
          'LrcShare',
          '感谢您的支持',
          'success'
        )
      })
    }
  })
}

// 文章打赏
var tipButtons = document.querySelectorAll(".tip-button");

function coinAudio() {
  var coinAudio = document.getElementById("coinAudio");
  if (coinAudio) {
    coinAudio.play(); //有音频时播放
  }
}
// Loop through all buttons (allows for multiple buttons on page)
tipButtons.forEach(button => {
  var coin = button.querySelector(".coin");

  // The larger the number, the slower the animation
  coin.maxMoveLoopCount = 90;

  button.addEventListener("click", () => {
    if (/Android|webOS|BlackBerry/i.test(navigator.userAgent)) return true; //媒体选择
    if (button.clicked) return;
    button.classList.add("clicked");

    // Wait to start flipping th coin because of the button tilt animation
    setTimeout(() => {
      // Randomize the flipping speeds just for fun
      coin.sideRotationCount = Math.floor(Math.random() * 5) * 90;
      coin.maxFlipAngle = (Math.floor(Math.random() * 4) + 3) * Math.PI;
      button.clicked = true;
      flipCoin();
      coinAudio();
    }, 50);
  });

  var flipCoin = () => {
    coin.moveLoopCount = 0;
    flipCoinLoop();
  };

  var resetCoin = () => {
    coin.style.setProperty("--coin-x-multiplier", 0);
    coin.style.setProperty("--coin-scale-multiplier", 0);
    coin.style.setProperty("--coin-rotation-multiplier", 0);
    coin.style.setProperty("--shine-opacity-multiplier", 0.4);
    coin.style.setProperty("--shine-bg-multiplier", "50%");
    coin.style.setProperty("opacity", 1);
    // Delay to give the reset animation some time before you can click again
    setTimeout(() => {
      button.clicked = false;
    }, 300);
  };

  var flipCoinLoop = () => {
    coin.moveLoopCount++;
    var percentageCompleted = coin.moveLoopCount / coin.maxMoveLoopCount;
    coin.angle = -coin.maxFlipAngle * Math.pow(percentageCompleted - 1, 2) + coin.maxFlipAngle;

    // Calculate the scale and position of the coin moving through the air
    coin.style.setProperty("--coin-y-multiplier", -11 * Math.pow(percentageCompleted * 2 - 1, 4) + 11);
    coin.style.setProperty("--coin-x-multiplier", percentageCompleted);
    coin.style.setProperty("--coin-scale-multiplier", percentageCompleted * 0.6);
    coin.style.setProperty("--coin-rotation-multiplier", percentageCompleted * coin.sideRotationCount);

    // Calculate the scale and position values for the different coin faces
    // The math uses sin/cos wave functions to similate the circular motion of 3D spin
    coin.style.setProperty("--front-scale-multiplier", Math.max(Math.cos(coin.angle), 0));
    coin.style.setProperty("--front-y-multiplier", Math.sin(coin.angle));

    coin.style.setProperty("--middle-scale-multiplier", Math.abs(Math.cos(coin.angle), 0));
    coin.style.setProperty("--middle-y-multiplier", Math.cos((coin.angle + Math.PI / 2) % Math.PI));

    coin.style.setProperty("--back-scale-multiplier", Math.max(Math.cos(coin.angle - Math.PI), 0));
    coin.style.setProperty("--back-y-multiplier", Math.sin(coin.angle - Math.PI));

    coin.style.setProperty("--shine-opacity-multiplier", 4 * Math.sin((coin.angle + Math.PI / 2) % Math.PI) - 3.2);
    coin.style.setProperty("--shine-bg-multiplier", -40 * (Math.cos((coin.angle + Math.PI / 2) % Math.PI) - 0.5) + "%");

    // Repeat animation loop
    if (coin.moveLoopCount < coin.maxMoveLoopCount) {
      if (coin.moveLoopCount === coin.maxMoveLoopCount - 6) button.classList.add("shrink-landing");
      window.requestAnimationFrame(flipCoinLoop);
    } else {
      button.classList.add("coin-landed");
      coin.style.setProperty("opacity", 0);
      setTimeout(() => {
        button.classList.remove("clicked", "shrink-landing", "coin-landed");
        setTimeout(() => {
          resetCoin();
        }, 300);
      }, 1500);
    }
  };
});

categoriesBarActive()
topCategoriesBarScroll()

//分类条
function categoriesBarActive(){
  var urlinfo = window.location.pathname;
  urlinfo = decodeURIComponent(urlinfo)
  // console.log(urlinfo);
  //判断是否是首页
  if (urlinfo == '/'){
    if (document.querySelector('#category-bar')){
      document.getElementById('首页').classList.add("select")
    }
  }else {
    // 验证是否是分类链接
    var pattern = /\/categories\/.*?\//;
    var patbool = pattern.test(urlinfo);
    // console.log(patbool);
    // 获取当前的分类
    if (patbool) {
      var valuegroup = urlinfo.split("/");
      console.log(valuegroup[2]);
      // 获取当前分类
      var nowCategorie = valuegroup[2];
      if (document.querySelector('#category-bar')){
        document.getElementById(nowCategorie).classList.add("select");
      }
    }
  }
  
}

//鼠标控制横向滚动
function topCategoriesBarScroll(){
  if (document.getElementById("category-bar-items")){
    let xscroll = document.getElementById("category-bar-items");
  xscroll.addEventListener("mousewheel", function (e) {
    //计算鼠标滚轮滚动的距离
    let v = -e.wheelDelta / 2;
    xscroll.scrollLeft += v;
    //阻止浏览器默认方法
    e.preventDefault();
}, false);
  }
}

//标签条
function tagsBarActive(){
  var urlinfo = window.location.pathname;
  urlinfo = decodeURIComponent(urlinfo)
  //console.log(urlinfo);
  //判断是否是首页
  if (urlinfo == '/'){
    if (document.querySelector('#tags-bar')){
      document.getElementById('首页').classList.add("select")
    }
  }else {
    // 验证是否是分类链接
    var pattern = /\/tags\/.*?\//;
    var patbool = pattern.test(urlinfo);
    //console.log(patbool);
    // 获取当前的标签
    if (patbool) {
      var valuegroup = urlinfo.split("/");
      //console.log(valuegroup[2]);
      // 获取当前分类
      var nowTag = valuegroup[2];
      if (document.querySelector('#category-bar')){
        document.getElementById(nowTag).classList.add("select");
      }
    }
  } 
}
tagsBarActive()
