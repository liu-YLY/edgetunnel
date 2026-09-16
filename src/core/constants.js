const Version = '2026-08-11 14:45:22';

const 默认SOCKS5白名单 = ['*tapecontent.net', '*cloudatacdn.com', '*loadshare.org', '*cdn-centaurus.com', 'scholar.google.com'];

const Pages静态页面 = 'https://edt-pages.github.io';

const WS早期数据最大字节 = 8 * 1024, WS早期数据最大头长度 = Math.ceil(WS早期数据最大字节 * 4 / 3) + 4;

const 上行合包目标字节 = 20 * 1024, 上行队列最大字节 = 1 * 1024 * 1024, 上行队列最大条目 = 2048;

const 下行Grain包字节 = 32 * 1024, 下行Grain尾部阈值 = 512, 下行Grain低水位字节 = Math.max(4096, 下行Grain尾部阈值 * 12), 下行Grain最大等待轮次 = 4;

const 特征码字典 = [
	(Proxy.name + "IP").toUpperCase(),
	(String.fromCharCode(67, 109) + URL.name[2] + 'i' + URL.name[0]).toLowerCase(),
	String(2407 * 300 - 10).split('').reverse().join('')
];

export { Pages静态页面, Version, WS早期数据最大头长度, WS早期数据最大字节, 上行合包目标字节, 上行队列最大字节, 上行队列最大条目, 下行Grain低水位字节, 下行Grain包字节, 下行Grain尾部阈值, 下行Grain最大等待轮次, 特征码字典, 默认SOCKS5白名单 };
