#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = os.homedir();
const PACKAGE_ROOT = process.env.NINE_ROUTER_PACKAGE_ROOT ||
  path.join(HOME, ".hermes/node/lib/node_modules/9router");
const PACKAGE_JSON = path.join(PACKAGE_ROOT, "package.json");
const SERVER_ROOT = path.join(PACKAGE_ROOT, "app/.next-cli-build/server");
const USAGE_RELATIVE = "chunks/7211.js";
const USAGE_CHUNK = path.join(SERVER_ROOT, USAGE_RELATIVE);
const UI_RELATIVES = new Set([
  "app/(dashboard)/dashboard/quota/page.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-5dcceb20e5aa06cf.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-870b92d68d6da60f.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-4a4e8b584d49bc4c.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-f863f4ec3b739500.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-c36e962e75b41c07.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-823b8581f95ccfaa.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-c31a0e5c041fa35d.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-f53ad0a50b4418ef.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-14020782e8f3bc6b.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js",
]);
const SUPPORTED_VERSIONS = new Set(["0.5.35", "0.5.40", "0.5.45", "0.5.50"]);
const UPSTREAM_CATALOG_HASHES = {
  "app/api/models/route.js": "7e150ccf2352d9457a204e87c89065a8ad81c9a3bdae1647ef6dbfab1efd9fc7",
  "app/api/provider-nodes/route.js": "a6f1767762b0b03f3a43b38c04eb9ab11fa60bf62fe9a5ac0be3b7cf8a36e1a2",
  "app/api/providers/client/route.js": "6468c375a2f7003d0798deb629394a0c8d25aae252ea35733b17842ca0c17ce7",
  "app/api/providers/route.js": "21e7d86e3d272904e3c410ff34d42d53e4857e3b94a4581639270ad5a906162b",
  "app/api/providers/validate/route.js": "62fb68b716c664fbd4727ff699af919f331ed92e72f7626c040e6cf6853c19f2",
  "app/api/translator/console-logs/route.js": "c73a8f43bf5f61494b661b20c74dababbc9d7c6640896f31a13f27672b45946f",
  "app/api/translator/console-logs/stream/route.js": "6797bfdb6ac36b6153eec6a279a9829a70b3d169ad77905cf00df663667fcaf0",
  "app/api/usage/providers/route.js": "feff8920bef028c0eca8150af8eb5a17203ca6f5d58dee1693420b718a4e5ba4",
  "app/api/v1/audio/speech/route.js": "493c42dab6d5b89e97d7a0eeca6801fdab7a35e2b30079e61544ff1a95375eef",
  "app/api/v1/audio/transcriptions/route.js": "34d6c1373094e1236b5fb5cdd350976448f39351e060089a2531f0a3c30b2a34",
  "app/api/v1/models/info/route.js": "e6033c5f28db2fedb599b4adc509b7493c728a90c60048d552012d5c6f578180",
  "app/api/v1beta/models/route.js": "ab0a78b24d6f7a3d646d1a33a5cbac0314d0a56adea8c6119e93a9cc440fc880",
  "chunks/2231.js": "916890f40b9425d97cbd23c57f0676173ea87d5856234215431ee189ac89e204",
  "chunks/4746.js": "d5f201f3c1015351eb9bfc9b81510b6eefa474e6cee453b6fede70d01002bfaa",
  "chunks/4827.js": "25e1cd6afb3dd217f9956a29e0d2c61ccc76254fc2eb1b79eb43aac2dcb8c5aa",
  "chunks/615.js": "d7efe526cd81539c92f9743c7745714dad24b4842cea7f731ccc4663a7de5b64",
  "chunks/8238.js": "37efbbd68e12d887e725522d9abf863217c50c13ec66428461ffdb8be32d29e5",
  "chunks/8271.js": "7770c89fec19cc45b1a2d8f7bf400f69da212f0b7c12d083936d972051bcd8a8",
  "chunks/9630.js": "3d1db13f60b81ceeb60cb2e4e2523471c87dbadb084d6d09ba9a9017ead6384b",
  "app/(dashboard)/dashboard/quota/page.js": "6e27a6c77cb844c6b12831cc80d84f498f60625d431453a7e2627583d76cf464",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-5dcceb20e5aa06cf.js": "6642239fe1e35258bab004b81078bed2dbb5f9accd4a25562d4e1194b1c62145",
};
const ENHANCED_CATALOG_HASHES = {
  "app/api/models/route.js": "97fb8c3bcd08fb67b650b751161f06a8bdebe837b6c514a5e7f1b610faa55c64",
  "app/api/provider-nodes/route.js": "430101d0720ce74f4521855d788bdcbe912a90e5aaf6c853513b2c14a34a8303",
  "app/api/providers/client/route.js": "6ac91d804cc5c716e53053d992ccf084fa1a1873f83e72acd5ce0b5b067a37a0",
  "app/api/providers/route.js": "ddf74e29f86e6ea0ff52b31cfe10975bca3f8bc1f201a7c293a0208ee68f0a85",
  "app/api/providers/validate/route.js": "0c1ba8803790d3888b180a51808270c295aab194c9636aaa5484ff545cde9073",
  "app/api/translator/console-logs/route.js": "76c9ab70d0b2a9e722682e2610f3bacfc657f7e1d9f90f4154707b13f8e0489e",
  "app/api/translator/console-logs/stream/route.js": "1df03c5c78912375400c35d90e37761b6b9d43384cdaaf35bfdfeb8d8d978bf5",
  "app/api/usage/providers/route.js": "396c894170f1ab5cc25f57bdc5041597c79f9b102a0c7d058b1596ed99161000",
  "app/api/v1/audio/speech/route.js": "a8c2160ab02da87bfdc8a08d6a579377ac8a348b88cdda9618defd9348f74448",
  "app/api/v1/audio/transcriptions/route.js": "e252ecb27d8f893f3ca96746f2c60268e0653615e78c2e967b4987994fe58c5b",
  "app/api/v1/models/info/route.js": "dae61a998aebdc42617cb18d7b0ff41fa0be2dac8424ab857dd67be2e16d93d6",
  "app/api/v1beta/models/route.js": "ae0a07ca97805dcb2be131623ed4c5a06b928ec2bb713feba7fbbb60f2369a07",
  "chunks/2231.js": "916890f40b9425d97cbd23c57f0676173ea87d5856234215431ee189ac89e204",
  "chunks/4746.js": "f20ad225e895a64ef51ac4be0f4442092e4a646c71f9a87c7e1e0a94b6ec3f13",
  "chunks/4827.js": "25e1cd6afb3dd217f9956a29e0d2c61ccc76254fc2eb1b79eb43aac2dcb8c5aa",
  "chunks/615.js": "d7efe526cd81539c92f9743c7745714dad24b4842cea7f731ccc4663a7de5b64",
  "chunks/8238.js": "37efbbd68e12d887e725522d9abf863217c50c13ec66428461ffdb8be32d29e5",
  "chunks/8271.js": "7770c89fec19cc45b1a2d8f7bf400f69da212f0b7c12d083936d972051bcd8a8",
  "chunks/9630.js": "3d1db13f60b81ceeb60cb2e4e2523471c87dbadb084d6d09ba9a9017ead6384b",
  "app/(dashboard)/dashboard/quota/page.js": "28398ce4513f781f8603e2d8df8453375a45b500e5a0370777c5302c6b05882d",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-870b92d68d6da60f.js": "4277a9a97a6fbc905e8bf7db774699da92aa23318cdb9dbc92856bda5423b77b",
};
const OFFICIAL_0535_CATALOG_HASHES = {
  "chunks/1829.js": "5a47eafdb2eb494aa49062405bfd710ed29e5a672eef7b04fc61e3cc1fd74d4d",
  "chunks/615.js": "d7efe526cd81539c92f9743c7745714dad24b4842cea7f731ccc4663a7de5b64",
  "chunks/7011.js": "1f37fd477af0bacf10d0a267f042a389e98b5ebdc55d74f5f072f7cd981c06da",
  "chunks/7211.js": "8649d5a3c0c6ae26cac0e9a929825b3bd32de80853e5be7729bcfe2e35cd5cb4",
  "chunks/827.js": "6b1a4f96c6995d8d5dfd9804ccaed7c7f8a7d3bbb723e2cf1b17551842083de2",
  "chunks/869.js": "baa6167a895f4d990beed132d2a734150f14a1c783b57755f356bdbf964d9a71",
  "app/api/provider-nodes/route.js": "e8750c989854b8f5d74dd5df6b84c71a7903180d2c95f4742feeabe17aae7095",
  "app/api/providers/client/route.js": "87631725154d2fdafd0c8088ba384254a951bd2a3f113455e7e035895c1ea75a",
  "app/api/providers/validate/route.js": "03593b3ef6d26e507fdb10194e29ae732bf5fb4e7d27b54363be83e82fd3775d",
  "app/api/usage/[connectionId]/route.js": "ddf6444af988cada6d6e07d3eada9c5e580a74736ef18da715ca4cbc88dd62fa",
  "app/api/usage/providers/route.js": "927e01c945f1ba8916ff3e2316a447924419f7061ec83d522b61dfe3053fadd9",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "39fc3605e2d881c0eb41ff27d877144b0a3e5ed75abe06762b1a91211b737267",
  "app/api/v1/audio/voices/route.js": "ee752f0d3d3b44e0dcbbf083749ee18ae8416b0d5111680e1e073d1c36dd3a18",
  "app/api/v1/models/info/route.js": "a8be98a1316ce26c9f3620bbbb17fcc763ca61f058fc6f95637e7cfe4f38d5e8",
  "app/api/v1beta/models/route.js": "71a2ef33077cd1906af3688bde526a18a71f6403914c3b02c5a30e4e3fd5ec3a",
  "app/(dashboard)/dashboard/quota/page.js": "5b7fb600fa5bd4a1a80170de3b62cfa8c756364883668649baf44cf69279587c",
  "../static/chunks/1321-7f70ea1854851a9b.js": "bd14232cfee41fd6e37c56f84c9896b2644d409d13d66ea009a91941fc8807b3",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-4a4e8b584d49bc4c.js": "0aacfa30c851c78a4d8aee57cb809593f3d3cd0e02a560cd88b4c6763ee984a8",
};
const ENHANCED_0535_CATALOG_HASHES = {
  "chunks/1829.js": "5a47eafdb2eb494aa49062405bfd710ed29e5a672eef7b04fc61e3cc1fd74d4d",
  "chunks/615.js": "d7efe526cd81539c92f9743c7745714dad24b4842cea7f731ccc4663a7de5b64",
  "chunks/6323.js": "96abaaa3eca8050d9b7ca4e6f2d6b5031872b8d2a7104163f7789ac5af79d2df",
  "chunks/7211.js": "f6e033feb6aa66c56ad1f21b3c5bc7a96a8bd671dd93723aeffdefa40dfdc83f",
  "chunks/827.js": "6b1a4f96c6995d8d5dfd9804ccaed7c7f8a7d3bbb723e2cf1b17551842083de2",
  "chunks/869.js": "baa6167a895f4d990beed132d2a734150f14a1c783b57755f356bdbf964d9a71",
  "app/api/provider-nodes/route.js": "900f80eeff3c13b57df0018d63e7b2031e4b88eb9c99586e968cbcd9c7a08578",
  "app/api/providers/client/route.js": "39981e12376bcec0592a7cd914f318f7017a255e1e57b7e8147c52c0f6aa4d1c",
  "app/api/providers/validate/route.js": "1eac5b362f756f65dda97440eac8970d5dbb71a4b8f913c8c1d54e9d6e17a5c1",
  "app/api/usage/[connectionId]/route.js": "44f8b09ec4f555dec8bd77241ebf7d95fa7f49242c42be9f1410f4728f569435",
  "app/api/usage/providers/route.js": "917839c509475f85fba9f99fb9459b64ed192ecb00a9e012cbbba90569ed78ab",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "e89aa546ed335781b3a493b83de991e4069d800f2fd9f14187d732b8f4b7baa0",
  "app/api/v1/audio/voices/route.js": "aee99d062e446112b8f733e340af130c1605ad849050f3e39f971646f52aaa67",
  "app/api/v1/models/info/route.js": "9b2146b1c04cc3f9549b8e96fa5daf5bcf7ab0baec00e96f82baf2b88262c717",
  "app/api/v1beta/models/route.js": "6ba12477bd329dcf175b0befdcf869dc2a16b88c9611eb2154c99ebf1628dde7",
  "app/(dashboard)/dashboard/quota/page.js": "d0596774e187e860e8c47de26671ef6580c0d0665c53a05af1eed714ac1807e0",
  "../static/chunks/1321-7f70ea1854851a9b.js": "bd14232cfee41fd6e37c56f84c9896b2644d409d13d66ea009a91941fc8807b3",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-f863f4ec3b739500.js": "18191964c4b89b1bea05564ce810e79d56404e54e17d5ae452f5a0ba46f96258",
};
const OFFICIAL_0540_CATALOG_HASHES = {
  "../static/chunks/1321-e8265f2c70e59151.js": "2c0eae4ca89617c85195c3623c6d3de283f7cd1f128fea75ba8dd580bb6ffe30",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-c36e962e75b41c07.js": "a72be7d966563e0e1bafc3a2ceb08f5979bf280a08131082140e6362da3ce5ea",
  "app/(dashboard)/dashboard/quota/page.js": "44c3a00a47f17fe3fbe89386d8ffb4697053aae7403ff7e1433cf741a4ead4a7",
  "app/api/provider-nodes/route.js": "0bcb6a6f2de497abc59028aec3bc1cf6c46f82e1af42c71ad497ee767ab51a23",
  "app/api/providers/client/route.js": "060b06afa0565aeac20192944ec25aac93802e5fcf5fecf84e57a693cbf4a09e",
  "app/api/providers/validate/route.js": "7e7c05b3953a5a9d9d02857f0b7706505884b6f7fdd41c97ecdffdf2fe877ab8",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "2afe90b4fa329a7befa787a05bde2c7966e2752c57ba82431a859be3ca754a20",
  "app/api/usage/[connectionId]/route.js": "e9483928a59713e5d6d5b614b22a47d0fae6cf024659c15f3b9a380892e5ee7f",
  "app/api/usage/providers/route.js": "3b059c0154612639eebc5608c28dfcccc43b634c34354e7a1b65b5ddc72e71ff",
  "app/api/v1/audio/voices/route.js": "e0224cb9614e79d19d340ae9bf19fe8ee1d3942e20514665b1ecf2797d8a3c5b",
  "app/api/v1/models/info/route.js": "bd2a812f684095d98d106c7518cd8a62cabb86c0f33c37fa9794023f83956791",
  "app/api/v1beta/models/route.js": "2806044f3c0597e825f5fb7a25d700e65be59cfc25d2fb42effd075f66313ac3",
  "chunks/1829.js": "a3a665d9f01a2a03999daeb07811a4901edc9329e65dc82e5413b97bfbc42a7d",
  "chunks/615.js": "52f5718ec2ef40d6e7c1029d63a89c1bc40c2d3cf526f38e0d9e297947196ed2",
  "chunks/7011.js": "ed5e82503b9be037f0fa5b8c645f87db38afcc5a20847da02cf2ef3f5694f39a",
  "chunks/7211.js": "8649d5a3c0c6ae26cac0e9a929825b3bd32de80853e5be7729bcfe2e35cd5cb4",
  "chunks/827.js": "78f986979bd1532033d2eac506d33598860610e3c72dc619229b8b0d2abb1a7e",
  "chunks/869.js": "2ca4ac91c7ee19c58b0b85382c912bf9ed44fbce137c507f8adcef42066fcfa0",
};
const ENHANCED_0540_CATALOG_HASHES = {
  "../static/chunks/1321-e8265f2c70e59151.js": "2c0eae4ca89617c85195c3623c6d3de283f7cd1f128fea75ba8dd580bb6ffe30",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-823b8581f95ccfaa.js": "10b4996510efb814574a857906b3c41cf15cbbb707e25d38e2e3f3a393f70ee4",
  "app/(dashboard)/dashboard/quota/page.js": "8e52365109214094739bfe769535b569a02028e3953e5ae8a08f4b4428589b3f",
  "app/api/provider-nodes/route.js": "5230cd1802f4f81a6b409fdd94400bed37baed7bc2b8cfb2516f612fa59fa787",
  "app/api/providers/client/route.js": "e19d98ac60e19135caa01f0fc5e1cd75626d0e3cc9bf88a18dc796a765d14018",
  "app/api/providers/validate/route.js": "a169d69cbb70ff8d0fedbb4b76e376fe206c78f959eccc7590a36995166b0178",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "df974ac606e87debe148c8bf751446e82b47b3f71ecee7158e0e1f6841be92fd",
  "app/api/usage/[connectionId]/route.js": "de905678dc1a6d72870c982bec2101785e812d20010b35285db93d2f53ef8449",
  "app/api/usage/providers/route.js": "1127ea250cadda1b433eddd6e48308a78a00584ce024a654181a3e7eaa763838",
  "app/api/v1/audio/voices/route.js": "4c666f2bfb569a264687ea360dab0f90d0db6778d41dfef876f9e0430f6a620f",
  "app/api/v1/models/info/route.js": "c3c293348ffbb663a49697eba2ebba67b682b2c9a21f59a56acd78feeca531ab",
  "app/api/v1beta/models/route.js": "4fca2f47222fff1398c480660a596a3fe4bb2da097d5b8488cc2066a8e6c4ed6",
  "chunks/1829.js": "a3a665d9f01a2a03999daeb07811a4901edc9329e65dc82e5413b97bfbc42a7d",
  "chunks/615.js": "52f5718ec2ef40d6e7c1029d63a89c1bc40c2d3cf526f38e0d9e297947196ed2",
  "chunks/7211.js": "f6e033feb6aa66c56ad1f21b3c5bc7a96a8bd671dd93723aeffdefa40dfdc83f",
  "chunks/827.js": "78f986979bd1532033d2eac506d33598860610e3c72dc619229b8b0d2abb1a7e",
  "chunks/869.js": "2ca4ac91c7ee19c58b0b85382c912bf9ed44fbce137c507f8adcef42066fcfa0",
  "chunks/9193.js": "7fc869a05ebeff34c6b1cd85fb32fb1ebe693fd2bc2c99d4d66e82867732030a",
};
const OFFICIAL_0545_CATALOG_HASHES = {
  "../static/chunks/1321-3cb00d56de5fba92.js": "fac7771008a54cd561990d90fbb0eb32f7b911839198fed7225ac07f7c416b4e",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-c31a0e5c041fa35d.js": "f4fca04b21cf76f1bcb4c46fb912b7a0ed7a609c1721d05458b76584eb8a3ae7",
  "app/(dashboard)/dashboard/quota/page.js": "0a86b838968876f79c1c888091d38bb510c19590e97ef4b4f8e0831ab0f51da0",
  "app/api/provider-nodes/route.js": "542351190a5a9238e83a25eb890c2d2a8bd3f84b816fd61a7e90c89deebfcdf8",
  "app/api/providers/client/route.js": "1c9da1e0e7805a66f608cb337aec42647d02659f318e27be37681b1697c34cdf",
  "app/api/providers/validate/route.js": "02c5643109a40e051c01947275ce057abd9823d082f8868ca0baa5318c6ef57a",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "769dfc8e6044af3c9ac0c1278465c019adfc9cd0f9fe4381d28a22fadc65e8ba",
  "app/api/usage/[connectionId]/route.js": "d094cbfcf17082f65976711f739574dad2b1389b8116afa24e0eb8159905c110",
  "app/api/usage/providers/route.js": "45a620aef8f9b371387cf02eb3ade19f2e6d75943d6d58c9e19786a59a49b230",
  "app/api/v1/audio/voices/route.js": "227be509569b035f2a111ca5470de27103c38ea91184b37065c8abd4345e6eac",
  "app/api/v1/models/info/route.js": "40105558c89958d0559f07d70dd120b0ef4194cc64f3be9b990cf9ae472560cb",
  "app/api/v1beta/models/route.js": "4fe662d9c2134ecc1172e4dc89247f7cc106e93b6bfe47ee92a4f0cfe1c5a6da",
  "chunks/1829.js": "a4b34684093eed1af55db50925e29d39a0dc97d3c79d83d006cbbee0a145d5e1",
  "chunks/615.js": "6d501294c0aa948539490ad3149920edf88e5112e0f92aa64c251b4026f743d1",
  "chunks/7011.js": "cae83b66bf97490b75aa433a9c7867f738044b62c8b59d6e54393107eb378787",
  "chunks/7211.js": "bde5fa92aee3323aea040d3b53aa587fb145e2ac60fde6395105abb8accf0056",
  "chunks/827.js": "ef4995a8d7570db1223b7d010ad13e49e1ad9d9c9dd46ee4867853961f33504b",
  "chunks/869.js": "7774c0ecdd8dd83ce7463335c7bb757762718eca4ab420e5357cb9140643ddcc",
};
const ENHANCED_0545_CATALOG_HASHES = {
  "../static/chunks/1321-3cb00d56de5fba92.js": "fac7771008a54cd561990d90fbb0eb32f7b911839198fed7225ac07f7c416b4e",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-f53ad0a50b4418ef.js": "34d4ca8e33f07c5934973e97dc5f112c29d3b2bd3f991f8afebb55631a245f62",
  "app/(dashboard)/dashboard/quota/page.js": "a0aef55bc18829d3df90c23dfe43bd7d776f0ec8c2bf2bf6ef1f68097a889961",
  "app/api/provider-nodes/route.js": "adbae9f5f0e2c34edc85020a2e4c1d5e7f990695c405dc2b1e12f7984d275f38",
  "app/api/providers/client/route.js": "57ff5a6e5e76410aae1128bf5e7268934f0901aa08226cb55258150920dfb27e",
  "app/api/providers/validate/route.js": "ab241e663869aec3fb0a6e310f035b0da17bfed00b4e63e777f702438ce3f601",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "181b054c1c7b2b2875f21778e41d9493af1ad175912699840444bc031fd43643",
  "app/api/usage/[connectionId]/route.js": "84c27d5acf7605d2cbc4d4204bece4c77158aac9e56d2bb6c64c9bd9bd93b6c0",
  "app/api/usage/providers/route.js": "7b4b4b0567e0c7c47e3ae55a9d0d5ae424978562a38bc4990b3e2da2f23e0688",
  "app/api/v1/audio/voices/route.js": "9e46b588441e3f2679013fe2eee52a94324dd221a3f9dda47123c9596e35785c",
  "app/api/v1/models/info/route.js": "8293fa9de3ab94bad2d5bbe023c7dc12235c022e0508dd505ee8705f035b42cf",
  "app/api/v1beta/models/route.js": "c12c0108198eac9939646461255da3ebd665a1ac2d06c9865d13158a82a2f112",
  "chunks/137.js": "891a52ec721ea12ec7e949920937ea4f9607f06c9016163645a0c25e310916b9",
  "chunks/1829.js": "a4b34684093eed1af55db50925e29d39a0dc97d3c79d83d006cbbee0a145d5e1",
  "chunks/615.js": "6d501294c0aa948539490ad3149920edf88e5112e0f92aa64c251b4026f743d1",
  "chunks/7211.js": "c247153650ffb38273691749bde384fd0c91c786c5b7f7fefc90ab13607dd5ad",
  "chunks/827.js": "ef4995a8d7570db1223b7d010ad13e49e1ad9d9c9dd46ee4867853961f33504b",
  "chunks/869.js": "7774c0ecdd8dd83ce7463335c7bb757762718eca4ab420e5357cb9140643ddcc",
};
const OFFICIAL_0550_CATALOG_HASHES = {
  "../static/chunks/1321-54939b699b5f3d07.js": "7d30d205a156971125ed575166de3df19ff97570e67c0e905800d53069b8536d",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-14020782e8f3bc6b.js": "dd2b35436c4bb20dd82272918978c2c7175f858d5dd96d0f6c1f3384d158dbfb",
  "app/(dashboard)/dashboard/quota/page.js": "ff8745d50baaf185ba46e4827a4a698bd574ecb80b36afc8e0884916ac2278ca",
  "app/api/provider-nodes/route.js": "190cc33d2ad712f57fa50ab6ff46f878b09a86b82717d58f0d1b0757314e4b32",
  "app/api/providers/client/route.js": "a0d305e0cad2cc8584b7fd8c3229135b876626f439b5335ce59d7f4c11adff83",
  "app/api/providers/validate/route.js": "6d47e58e09a5b0ba009cb02c96ebb4ab9eac39adfa304d1c3827b45489e4e831",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "c00bf7c20c117b73fc0c2677523bac2ace79650fe2f186d3072cc7cc4e0da8c7",
  "app/api/usage/[connectionId]/route.js": "da2036a8b76500b9355021e56d6e7257de22870fdc9878f4c5266e45e892e946",
  "app/api/usage/providers/route.js": "b05a8706aa4d7129c2e13079932d19fe46e39fc4cd2ae72500986a36e20e98de",
  "app/api/v1/audio/voices/route.js": "4577ec2c2b30876c019df6e803f239824664bf7eef169c1a9fbffe835244b0f1",
  "app/api/v1/models/info/route.js": "6fe06fc90c8609be920838fa012878e719e9d1b12ca0e467da4315eb55417a14",
  "app/api/v1beta/models/route.js": "0a8327f3f287cd2aca29661d241e54dd12761272e64be019005e2066b23545c0",
  "chunks/4664.js": "7924627d1ec3d2f9f0fea16fa2bd4b88f471de415c4e9ae69cf732cbff00c5ee",
  "chunks/5619.js": "b1107aed705bc1704a5fb6c6ada646c51eafe47c56c1ca986ba997438b77ca3f",
  "chunks/615.js": "bfd8435754e8bcb52d6824191d0070ef89842aa4078161a09bab3860374fff7e",
  "chunks/7011.js": "148c665aa9c826e244a6ebff3b4de37fbdbdedd0415e162525aad853b8dcdc71",
  "chunks/7211.js": "5a8e7061cda779abd7a279989db419dad362d6393373a0cc0aa0421a35e091d0",
  "chunks/827.js": "0608c99028f03a66f8b135670936a57f6eeb8cc3125e684e32e2ff6f413658c8",
  "chunks/869.js": "53b6231711cd75add1216e016399c80b150b79846530a38fabbe622921af3f1b",
  "chunks/8847.js": "557e988bea8cba14a5e8cde8f7a634cb2dc4b5f2f2edc44f778e98481e807db7",
};
const ENHANCED_0550_CATALOG_HASHES = {
  "../static/chunks/1321-54939b699b5f3d07.js": "7d30d205a156971125ed575166de3df19ff97570e67c0e905800d53069b8536d",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js": "743661551bc5a8f676412cdd55499d1b248ee9218c174101f4cca53548ba826c",
  "app/(dashboard)/dashboard/quota/page.js": "cbd82ee7b0d097784fb65ee084f32993404159a40fe7075e3c44214ba66c01c8",
  "app/api/provider-nodes/route.js": "76cd242cbafbdda07059bbbbf4bfc3f0323943ed9e4cd9a9a8ad7be190676c6a",
  "app/api/providers/client/route.js": "8c48f57a886d845c0e153286934313287c807a7110a2470c692e1cd2446702ab",
  "app/api/providers/validate/route.js": "e86a2b8c7aeff19f4bafccb34f417b1fd71fa8452998ee91705df8c2ab3d01ab",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js": "060616d4a31e722e1638ace7c5ef8b3ea88d48a1a00d40665e8ba6e682844273",
  "app/api/usage/[connectionId]/route.js": "c66e5cc5c516eed98f97dd9a79f9d80bc307b6ffb80ca25e58c73477bee4a037",
  "app/api/usage/providers/route.js": "c9b57c13587362a5d90ad3b83dab0d78189c3f3a01f3d02ceb8499592a6b80a4",
  "app/api/v1/audio/voices/route.js": "617314684a72adff457d865574a864dfae988446eda5a7ba961bac8d1f0ab26e",
  "app/api/v1/models/info/route.js": "439fd261ca4c5acc47ab3a452fc2ff0fb497e711da895be6da4f209abfcf5e20",
  "app/api/v1beta/models/route.js": "29726f3117ef30bd5b71ef1a3662ddf319268ba0e9eea6ada4bea9da1f74cdd7",
  "chunks/4664.js": "7924627d1ec3d2f9f0fea16fa2bd4b88f471de415c4e9ae69cf732cbff00c5ee",
  "chunks/5619.js": "b1107aed705bc1704a5fb6c6ada646c51eafe47c56c1ca986ba997438b77ca3f",
  "chunks/615.js": "bfd8435754e8bcb52d6824191d0070ef89842aa4078161a09bab3860374fff7e",
  "chunks/4963.js": "4549697c5cbcea52dd6de0a36d2ec0852836999b00318f8bfbf512c33ea49eb4",
  "chunks/4695.js": "384c4efe328c71934954b6b34aa6f1bb42a90340abbd56e47b17022a2a584baf",
  "chunks/318.js": "4067688b0d9b8a8821fa11f8262c4761149428ac6c57bf81b7443e09c2068a80",
  "chunks/7211.js": "adf7d6d0ad78d284339c22d3aa43f54055373525e2c4782cee291acf2bdc2d59",
  "chunks/827.js": "0608c99028f03a66f8b135670936a57f6eeb8cc3125e684e32e2ff6f413658c8",
  "chunks/869.js": "53b6231711cd75add1216e016399c80b150b79846530a38fabbe622921af3f1b",
  "chunks/8847.js": "f4388200a63b4b29177f79726a6f89b72a1aa33cde9c78cb12963e57ed80b723",
};
// Fingerprint files are unique per official/enhanced build of each release.
const CATALOG_VARIANTS = [
  {
    name: "enhanced-0.5.50",
    fingerprint: "../static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js",
    hashes: ENHANCED_0550_CATALOG_HASHES,
  },
  {
    name: "official-0.5.50",
    fingerprint: "../static/chunks/app/(dashboard)/dashboard/quota/page-14020782e8f3bc6b.js",
    hashes: OFFICIAL_0550_CATALOG_HASHES,
  },
  {
    name: "enhanced-0.5.45",
    fingerprint: "../static/chunks/app/(dashboard)/dashboard/quota/page-f53ad0a50b4418ef.js",
    hashes: ENHANCED_0545_CATALOG_HASHES,
  },
  {
    name: "official-0.5.45",
    fingerprint: "../static/chunks/app/(dashboard)/dashboard/quota/page-c31a0e5c041fa35d.js",
    hashes: OFFICIAL_0545_CATALOG_HASHES,
  },
  {
    name: "enhanced-0.5.40",
    fingerprint: "../static/chunks/app/(dashboard)/dashboard/quota/page-823b8581f95ccfaa.js",
    hashes: ENHANCED_0540_CATALOG_HASHES,
  },
  {
    name: "official-0.5.40",
    fingerprint: "../static/chunks/app/(dashboard)/dashboard/quota/page-c36e962e75b41c07.js",
    hashes: OFFICIAL_0540_CATALOG_HASHES,
  },
  {
    name: "enhanced-0.5.35",
    fingerprint: "../static/chunks/app/(dashboard)/dashboard/quota/page-f863f4ec3b739500.js",
    hashes: ENHANCED_0535_CATALOG_HASHES,
  },
  {
    name: "official-0.5.35",
    fingerprint: "../static/chunks/app/(dashboard)/dashboard/quota/page-4a4e8b584d49bc4c.js",
    hashes: OFFICIAL_0535_CATALOG_HASHES,
  },
];
const SELECTED_CATALOG = CATALOG_VARIANTS.find((variant) =>
  fs.existsSync(path.join(SERVER_ROOT, variant.fingerprint)),
) || {
  name: "official-0.5.50",
  hashes: OFFICIAL_0550_CATALOG_HASHES,
};
const CATALOG_VARIANT = SELECTED_CATALOG.name;
const CATALOG_HASHES = SELECTED_CATALOG.hashes;
const ORIGINALS_DIR = path.join(__dirname, `quota-tracker-originals/${CATALOG_VARIANT}`);
const MAIN_MARKER = "/* QuotaTrackerPatch:v2 */";
const PROVIDERS_MARKER = "/* QuotaTrackerProviders:v2 */";
const UI_MARKER = "/* QuotaTrackerCurrency:v2 */";
const PROVIDER_CATALOG_MARKER = "/* QuotaTrackerAlibabaProvider:v1 */";
const UI_STATUS_MARKER = "/* QuotaTrackerAlibabaStatus:v1 */";
const OPENCODE_GO_CATALOG_MARKER = "/* OpenCodeGoCatalog:v1 */";
const OPENCODE_GO_RUNTIME_MARKER = "/* OpenCodeGoRuntime:v1 */";
const OPENCODE_GO_MODELS_OLD =
  'models:[{id:"glm-5.2",name:"GLM 5.2"},{id:"glm-5.1",name:"GLM 5.1"},{id:"kimi-k2.7-code",name:"Kimi K2.7 Code"},{id:"kimi-k2.6",name:"Kimi K2.6"},{id:"deepseek-v4-pro",name:"DeepSeek V4 Pro"},{id:"deepseek-v4-flash",name:"DeepSeek V4 Flash"},{id:"mimo-v2.5",name:"MiMo V2.5"},{id:"mimo-v2.5-pro",name:"MiMo V2.5 Pro"},{id:"minimax-m3",name:"MiniMax M3",targetFormat:"claude"},{id:"minimax-m2.7",name:"MiniMax M2.7",targetFormat:"claude"},{id:"minimax-m2.5",name:"MiniMax M2.5",targetFormat:"claude"},{id:"qwen3.7-max",name:"Qwen 3.7 Max",targetFormat:"claude"},{id:"qwen3.7-plus",name:"Qwen 3.7 Plus",targetFormat:"claude"},{id:"qwen3.6-plus",name:"Qwen 3.6 Plus",targetFormat:"claude"}]';
const OPENCODE_GO_MODELS_NEW =
  'models:[{id:"minimax-m3",name:"MiniMax M3",targetFormat:"claude"},{id:"minimax-m2.7",name:"MiniMax M2.7",targetFormat:"claude"},{id:"minimax-m2.5",name:"MiniMax M2.5",targetFormat:"claude"},{id:"kimi-k3",name:"Kimi K3"},{id:"kimi-k2.7-code",name:"Kimi K2.7 Code"},{id:"kimi-k2.6",name:"Kimi K2.6"},{id:"kimi-k2.5",name:"Kimi K2.5"},{id:"glm-5.2",name:"GLM 5.2"},{id:"glm-5.1",name:"GLM 5.1"},{id:"glm-5",name:"GLM 5"},{id:"deepseek-v4-pro",name:"DeepSeek V4 Pro"},{id:"deepseek-v4-flash",name:"DeepSeek V4 Flash"},{id:"qwen3.7-max",name:"Qwen 3.7 Max",targetFormat:"claude"},{id:"qwen3.8-max",name:"Qwen 3.8 Max",targetFormat:"claude"},{id:"qwen3.7-plus",name:"Qwen 3.7 Plus",targetFormat:"claude"},{id:"qwen3.6-plus",name:"Qwen 3.6 Plus",targetFormat:"claude"},{id:"qwen3.5-plus",name:"Qwen 3.5 Plus",targetFormat:"claude"},{id:"mimo-v2-pro",name:"MiMo V2 Pro"},{id:"mimo-v2-omni",name:"MiMo V2 Omni"},{id:"mimo-v2.5-pro",name:"MiMo V2.5 Pro"},{id:"mimo-v2.5",name:"MiMo V2.5"},{id:"hy3",name:"HY3"},{id:"hy3-preview",name:"HY3 Preview"},{id:"gpt-5.6-luna",name:"GPT-5.6 Luna"},{id:"grok-4.5",name:"Grok 4.5"}]' + OPENCODE_GO_CATALOG_MARKER;
const OPENCODE_GO_RUNTIME_OLD =
  'let h=new Set(["minimax-m3","minimax-m2.7","minimax-m2.5","qwen3.7-max","qwen3.7-plus","qwen3.6-plus"])';
const OPENCODE_GO_RUNTIME_NEW =
  'let h=new Set(["minimax-m3","minimax-m2.7","minimax-m2.5","qwen3.7-max","qwen3.8-max","qwen3.7-plus","qwen3.6-plus","qwen3.5-plus"])' + OPENCODE_GO_RUNTIME_MARKER;
const OPENCODE_GO_CATALOG_RELATIVES = new Set([
  "chunks/4963.js",
  "chunks/4695.js",
  "chunks/5619.js",
]);
const OPENCODE_GO_RUNTIME_RELATIVES = new Set(["chunks/318.js"]);
const OPENCODE_GO_DIRECT_RELATIVES = new Set([
  "chunks/4963.js",
  "chunks/318.js",
]);
const LEGACY_MARKERS = [
  "/* QuotaTrackerPatch:v2 */",
  "/* QuotaTrackerProviders:v2 */",
  "/* QuotaTrackerCurrency:v2 */",
  OPENCODE_GO_CATALOG_MARKER,
  OPENCODE_GO_RUNTIME_MARKER,
];

const CANONICAL_PROVIDER = {
  id: "qwen-cloud-token-plan",
  alias: "qct",
  display: {
    name: "Qwen Cloud Token Plan",
    icon: "cloud",
    color: "#FF6A00",
    textIcon: "QCT",
    website: "https://www.alibabacloud.com/help/en/model-studio/token-plan-overview",
    notice: {
      apiKeyUrl: "https://www.alibabacloud.com/help/en/model-studio/token-plan-overview",
    },
  },
  category: "apikey",
  transport: {
    format: "openai",
    baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
    validateUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models",
    auth: { combined: true, header: "Authorization", scheme: "bearer" },
  },
  models: [
    { id: "qwen3.8-max-preview", name: "Qwen3.8 Max Preview", supportsReasoning: true, supportsVision: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 65536 },
    { id: "qwen3.7-max", name: "Qwen3.7 Max", supportsReasoning: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 65536 },
    { id: "qwen3.7-plus", name: "Qwen3.7 Plus", supportsReasoning: true, supportsVision: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 65536 },
    { id: "qwen3.6-flash", name: "Qwen3.6 Flash", supportsReasoning: true, supportsVision: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 32768 },
    { id: "glm-5.2", name: "GLM 5.2", supportsReasoning: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 16384 },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", supportsReasoning: true, toolCalling: true, contextLength: 163840, maxOutputTokens: 32768 },
  ],
  features: { usage: true, usageApikey: true },
};

function patchOpenCodeGoCatalog(content) {
  if (content.includes(OPENCODE_GO_CATALOG_MARKER)) return content;
  if (!content.includes('id:\"opencode-go\"')) return content;
  const count = content.split(OPENCODE_GO_MODELS_OLD).length - 1;
  if (count !== 1) {
    throw new Error(`OpenCode Go catalog marker expected once, found ${count}`);
  }
  return content.replace(OPENCODE_GO_MODELS_OLD, OPENCODE_GO_MODELS_NEW);
}

function patchOpenCodeGoRuntime(content) {
  if (content.includes(OPENCODE_GO_RUNTIME_MARKER)) return content;
  if (!content.includes('super(\"opencode-go\"')) return content;
  const count = content.split(OPENCODE_GO_RUNTIME_OLD).length - 1;
  if (count !== 1) {
    throw new Error(`OpenCode Go runtime marker expected once, found ${count}`);
  }
  return content.replace(OPENCODE_GO_RUNTIME_OLD, OPENCODE_GO_RUNTIME_NEW);
}

function buildProviderCatalogPatched(original) {
  if (original.includes(PROVIDER_CATALOG_MARKER)) return original;

  let result = patchOpenCodeGoCatalog(patchOpenCodeGoRuntime(original));

  // Server bundles that embed module 40615.
  const catalogModuleIdx = result.indexOf("40615:(");
  const serverRequireMatch =
    catalogModuleIdx >= 0
      ? result.slice(catalogModuleIdx).match(/var d=c\(\d+\);/)
      : null;
  if (serverRequireMatch) {
    const serverEntry = JSON.stringify(CANONICAL_PROVIDER);
    const injectCode = `{let a=${serverEntry};d.A.some(b=>b.id===a.id)||d.A.push(a);}`;
    const insertAt =
      catalogModuleIdx + serverRequireMatch.index + serverRequireMatch[0].length;
    result =
      result.slice(0, insertAt) +
      injectCode +
      result.slice(insertAt);
  }

  // Client chunk 1321-*.js
  const anchorIdx = result.indexOf('id:"alicode-intl"');
  if (anchorIdx >= 0 && !serverRequireMatch) {
    let arrStart = -1;
    for (let i = anchorIdx; i >= 0; i--) {
      if (result[i] === "[" && (result[i - 1] === "=" || result[i - 1] === ":")) {
        arrStart = i;
        break;
      }
    }
    if (arrStart < 0) {
      throw new Error("Client provider array opening delimiter not found");
    }
    let depth = 0;
    let arrEnd = -1;
    for (let i = arrStart; i < result.length; i++) {
      if (result[i] === "[") depth++;
      else if (result[i] === "]") {
        depth--;
        if (depth === 0) {
          arrEnd = i;
          break;
        }
      }
    }
    if (arrEnd < 0) {
      throw new Error("Client provider array closing delimiter not found");
    }
    const clientEntry = JSON.stringify(CANONICAL_PROVIDER);
    result =
      result.slice(0, arrEnd) +
      "," +
      clientEntry +
      result.slice(arrEnd);
  }

  // Alias lookup patch in module 57729 (in validate/route.js and similar)
  const obMatch = "a.name?.toLowerCase()===b.toLowerCase()";
  if (result.includes("57729:(") && result.includes(obMatch)) {
    result = result.replace(
      obMatch,
      "a.name?.toLowerCase()===b.toLowerCase()||a.alias?.toLowerCase()===b.toLowerCase()||a.uiAlias?.toLowerCase()===b.toLowerCase()"
    );
  }

  // Test route switch case in chunks/827.js
  const nvidiaCase = 'case"nvidia":{let c=await t("https://integrate.api.nvidia.com/v1/models"';
  if (result.includes(nvidiaCase)) {
    const qctTestCode = 'case"qwen-cloud-token-plan":case"qct":{let c=await t("https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models",{headers:{Authorization:`Bearer ${a.apiKey}`}},b);return{valid:c.ok,error:c.ok?null:"Invalid API key"}}';
    result = result.replace(nvidiaCase, qctTestCode + nvidiaCase);
  }
  // Validate route switch case in validate/route.js
  const nvidiaMulti = 'case"xiaomi-tokenplan":case"nvidia":';
  if (result.includes(nvidiaMulti)) {
    result = result.replace(nvidiaMulti, 'case"xiaomi-tokenplan":case"nvidia":case"qwen-cloud-token-plan":case"qct":');
    const xmtpMap = '"xiaomi-tokenplan":`${(0,h.Yg)({providerSpecificData:o})}/models`';
    if (result.includes(xmtpMap)) {
      result = result.replace(xmtpMap, xmtpMap + ',"qwen-cloud-token-plan":"https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models","qct":"https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/models"');
    }
  }

  if (result === original) {
    throw new Error("Target chunk for provider catalog patch not recognized");
  }

  return result + PROVIDER_CATALOG_MARKER;
}
// Legacy 0.5.40 marker strings kept for stripV1 cleanup helpers.
const USAGE_ALLOW_MARKER =
  "x=d.A.filter(a=>a.features?.usage).map(a=>a.id)";
const USAGE_ALLOW_PATCHED =
  'x=[...new Set([...d.A.filter(a=>a.features?.usage).map(a=>a.id),"openrouter","deepseek","commandcode","xai","xiaomi-mimo","clinepass","qwen-cloud-token-plan"])]';
const API_KEY_ALLOW_MARKER =
  "y=d.A.filter(a=>a.features?.usageApikey).map(a=>a.id)";
const API_KEY_ALLOW_PATCHED =
  'y=[...new Set([...d.A.filter(a=>a.features?.usageApikey).map(a=>a.id),"openrouter","deepseek","commandcode","xiaomi-mimo","clinepass","qwen-cloud-token-plan"])]';

function qtpNum(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function qtpReset(value) {
  if (!value || typeof value === "boolean" || Array.isArray(value)) return null;
  if (typeof value === "object" && !(value instanceof Date)) return null;
  if (Number(value) === 0) return null;
  const num = Number(value);
  const val = Number.isFinite(num) ? (num < 1e12 ? num * 1000 : num) : value;
  const date = new Date(val);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function qtpDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

function qtpQuota(used, total, resetAt = null) {
  const safeUsed = Math.max(0, qtpNum(used, 0));
  const safeTotal = Math.max(0, qtpNum(total, 0));
  const remaining = Math.max(0, safeTotal - safeUsed);
  return {
    used: safeUsed,
    total: safeTotal,
    remainingPercentage: safeTotal > 0 ? (remaining / safeTotal) * 100 : 0,
    resetAt: qtpReset(resetAt),
    unlimited: false,
  };
}

function qtpBalance(amount, resetAt = null) {
  const balance = Math.max(0, qtpNum(amount, 0));
  return {
    used: 0,
    total: balance,
    remainingPercentage: balance > 0 ? 100 : 0,
    resetAt: qtpReset(resetAt),
    unlimited: false,
  };
}

function qtpParseOpenRouter(body) {
  const data = body && typeof body.data === "object" ? body.data : body;
  const total = qtpNum(data?.total_credits);
  const used = qtpNum(data?.total_usage);
  if (Number.isFinite(total) && Number.isFinite(used)) {
    return {
      plan: "Credits",
      quotas: { "Credits (USD)": qtpQuota(used, total) },
    };
  }

  const limit = qtpNum(data?.limit);
  const usage = qtpNum(data?.usage, 0);
  if (Number.isFinite(limit) && limit > 0) {
    return {
      plan: data?.is_free_tier ? "Free" : "API key",
      quotas: {
        "Key limit (USD)": qtpQuota(usage, limit, data?.limit_reset),
      },
    };
  }
  return null;
}

function qtpParseDeepSeek(body) {
  const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
  const quotas = {};
  for (const info of infos) {
    const currency = String(info?.currency || "USD").toUpperCase();
    const total = qtpNum(info?.total_balance, 0);
    const granted = qtpNum(info?.granted_balance, 0);
    const toppedUp = qtpNum(info?.topped_up_balance, 0);
    quotas[`Available balance (${currency})`] = qtpBalance(total);
    if (granted > 0) quotas[`Promotional balance (${currency})`] = qtpBalance(granted);
    if (toppedUp > 0) quotas[`Topped up balance (${currency})`] = qtpBalance(toppedUp);
  }
  if (!Object.keys(quotas).length) return null;
  return {
    plan: body?.is_available === false ? "Unavailable" : "API balance",
    quotas,
  };
}

function qtpParseCommandCode(body, subscriptionBody = null) {
  const credits = body?.credits || {};
  const limits = body?.windowLimits || {};
  const subscription = subscriptionBody?.data || subscriptionBody || {};
  const renewalAt = subscription.currentPeriodEnd || null;
  const renewalDate = qtpDate(renewalAt);
  const quotas = {};
  const monthly = qtpNum(credits.monthlyCredits, 0);
  const purchased = qtpNum(credits.purchasedCredits, 0);
  const free = qtpNum(credits.freeCredits, 0);
  if (monthly > 0) {
    const monthlyName = renewalDate
      ? `Monthly credits (USD) - renews ${renewalDate}`
      : "Monthly credits (USD)";
    quotas[monthlyName] = qtpBalance(monthly, renewalAt);
  }
  if (purchased > 0) quotas["Purchased credits (USD)"] = qtpBalance(purchased);
  if (free > 0) quotas["Free credits (USD)"] = qtpBalance(free);

  const fiveHour = limits.fiveHour;
  if (fiveHour && qtpNum(fiveHour.cap, 0) > 0) {
    quotas["5 hour window (USD)"] = qtpQuota(
      fiveHour.used,
      fiveHour.cap,
      fiveHour.resetAt,
    );
  }
  const weekly = limits.weekly;
  if (weekly && qtpNum(weekly.cap, 0) > 0) {
    quotas["7 day window (USD)"] = qtpQuota(
      weekly.used,
      weekly.cap,
      weekly.resetAt,
    );
  }
  if (!Object.keys(quotas).length) return null;
  const planId = String(subscription.planId || "");
  const plan = planId
    ? planId
        .replace(/^individual-/, "")
        .replace(/^teams-/, "Teams ")
        .replace(/(^|[- ])\w/g, (match) => match.toUpperCase().replace("-", " "))
    : limits.limited === false
      ? "Pay as you go"
      : "Subscription";
  return { plan, quotas };
}

function qtpNormalizeXai(result) {
  if (!result?.quotas || typeof result.quotas !== "object") return result;
  const quotas = { ...result.quotas };
  const config = result.rawConfig || {};
  const usagePercent = qtpNum(
    config.creditUsagePercent ?? config.credit_usage_percent,
  );
  const period = config.currentPeriod || config.current_period || {};
  const periodType = String(period.type || "").toUpperCase();
  const hasIncludedQuota = Object.keys(quotas).some((name) =>
    /included|subscription usage/i.test(name),
  );
  let addedSubscriptionUsage = false;
  if (
    Number.isFinite(usagePercent) &&
    !hasIncludedQuota &&
    (!periodType || periodType.includes("WEEKLY"))
  ) {
    quotas["Subscription usage (weekly)"] = qtpQuota(
      Math.min(100, usagePercent),
      100,
      period.end || period.resetAt || config.billingPeriodEnd,
    );
    addedSubscriptionUsage = true;
  }

  const prepaid = quotas.Prepaid;
  if (prepaid) {
    delete quotas.Prepaid;
    quotas["Prepaid balance (USD)"] = qtpBalance(
      qtpNum(prepaid.total, 0) / 100,
      prepaid.resetAt,
    );
  }
  const { rawConfig, ...normalized } = result;
  if (
    addedSubscriptionUsage &&
    /does not expose a numeric included quota/i.test(normalized.message || "")
  ) {
    delete normalized.message;
  }
  return { ...normalized, quotas };
}

function qtpParseMimo(body) {
  const data = body?.data || body?.result || body;
  if (!data || typeof data !== "object") return null;
  const balance = qtpNum(data.balance);
  if (!Number.isFinite(balance)) return null;
  const currency = String(data.currency || "USD").toUpperCase();
  const quotas = {
    [`Available balance (${currency})`]: qtpBalance(balance),
  };
  const cash = qtpNum(data.cashBalance);
  const gift = qtpNum(data.giftBalance);
  if (Number.isFinite(cash) && cash > 0) {
    quotas[`Paid balance (${currency})`] = qtpBalance(cash);
  }
  if (Number.isFinite(gift) && gift > 0) {
    quotas[`Granted balance (${currency})`] = qtpBalance(gift);
  }
  return { plan: "API balance", quotas };
}

function qtpParseCline(planBody, usageItems, now = Date.now()) {
  const current = planBody?.data || planBody || {};
  const plan = current.plan || {};
  const pass = plan.entitlements?.cline_pass;
  const limits = pass?.inferenceCapThreshold;
  if (!pass?.enabled || !limits) return null;

  const nowMs = qtpNum(now, Date.now());
  const scale = 100000000;
  const definitions = [
    ["5 hour window (USD)", 5 * 60 * 60 * 1000, limits.last5HoursUsageCostUSDPerUser],
    ["7 day window (USD)", 7 * 24 * 60 * 60 * 1000, limits.last7daysUsageCostUSDPerUser],
    ["30 day window (USD)", 30 * 24 * 60 * 60 * 1000, limits.last30daysUsageCostUSDPerUser],
  ];
  const items = Array.isArray(usageItems) ? usageItems : [];
  const quotas = {};
  for (const [name, duration, rawLimit] of definitions) {
    const limit = qtpNum(rawLimit, 0);
    if (limit <= 0) continue;
    let used = 0;
    let earliest = null;
    const cutoff = nowMs - duration;
    for (const item of items) {
      const createdAt = new Date(item?.createdAt).getTime();
      if (!Number.isFinite(createdAt) || createdAt < cutoff || createdAt > nowMs) continue;
      used += Math.max(0, qtpNum(item?.costUsd, 0));
      if (earliest === null || createdAt < earliest) earliest = createdAt;
    }
    quotas[name] = qtpQuota(
      used / scale,
      limit / scale,
      earliest === null ? null : earliest + duration,
    );
  }
  if (!Object.keys(quotas).length) return null;
  const renewalDate = qtpDate(current.currentPeriodEnd);
  const displayName = String(plan.displayName || plan.name || "ClinePass").replace(/\[Internal\]/g, "").trim();
  return {
    plan: renewalDate ? `${displayName} - renews ${renewalDate}` : displayName,
    quotas,
  };
}

function qtpLocalQuota(used, limit) {
  const safeUsed = Math.max(0, qtpNum(used, 0));
  const safeLimit = Math.max(0, qtpNum(limit, 0));
  if (safeLimit > 0) {
    const remaining = Math.max(0, safeLimit - safeUsed);
    return {
      used: safeUsed,
      total: safeLimit,
      remainingPercentage: (remaining / safeLimit) * 100,
      resetAt: null,
      unlimited: false,
    };
  }
  return {
    used: safeUsed,
    total: 0,
    resetAt: null,
    unlimited: true,
  };
}

function qtpCalcSlidingWindowUsage(records, now = Date.now(), limits = {}) {
  const fiveHourMs = 5 * 3600 * 1000;
  const sevenDayMs = 7 * 86400 * 1000;
  const cutoff5h = now - fiveHourMs;
  const cutoff7d = now - sevenDayMs;

  let fiveHourTokens = 0;
  let sevenDayTokens = 0;

  if (Array.isArray(records)) {
    for (const r of records) {
      const p = qtpNum(r?.promptTokens, 0);
      const c = qtpNum(r?.completionTokens, 0);
      const tokens = p + c;
      const t =
        typeof r?.timestamp === "number"
          ? r.timestamp
          : r?.timestamp
          ? new Date(r.timestamp).getTime()
          : NaN;
      if (!Number.isFinite(t)) continue;
      if (t >= cutoff7d && t <= now) {
        sevenDayTokens += tokens;
        if (t >= cutoff5h) {
          fiveHourTokens += tokens;
        }
      }
    }
  }

  const limit5h = qtpNum(
    limits?.limit5h || limits?.quotaLimit5h || limits?.fiveHourLimit,
    0,
  );
  const limit7d = qtpNum(
    limits?.limit7d || limits?.quotaLimit7d || limits?.sevenDayLimit,
    0,
  );

  return {
    plan: "Alibaba Token Plan (medido pelo router)",
    status: "ok",
    source: "router-local",
    fetchedAt: new Date(now).toISOString(),
    quotas: {
      "Consumo 5h (medido local)": qtpLocalQuota(fiveHourTokens, limit5h),
      "Consumo 7d (medido local)": qtpLocalQuota(sevenDayTokens, limit7d),
    },
  };
}

async function qtpAlibaba(arg, now = Date.now()) {
  const connId = String(arg?.connectionId || arg?.id || "").trim();
  const psd = arg?.providerSpecificData || {};
  const sevenDayMs = 7 * 86400 * 1000;
  const cutoff7dIso = new Date(now - sevenDayMs).toISOString();

  let rows = [];
  try {
    let db = globalThis._dbAdapter?.instance || global._dbAdapter?.instance;
    const webpackRequire =
      typeof c === "function" ? c : typeof __webpack_require__ === "function" ? __webpack_require__ : null;
    // 89718/71998 are already in the usage chunk graph. 36366 lives in
    // another chunk and is not loadable from the quota collector.
    if (!db && webpackRequire) {
      for (const moduleId of [89718, 71998, 36366]) {
        try {
          const dbMod = webpackRequire(moduleId);
          if (dbMod && typeof dbMod.c === "function") {
            db = await dbMod.c();
            if (db) break;
          }
        } catch (_) {}
      }
    }
    if (db && typeof db.all === "function") {
      if (connId) {
        rows = db.all(
          "SELECT promptTokens, completionTokens, timestamp FROM usageHistory WHERE (provider = 'qwen-cloud-token-plan' OR connectionId = ?) AND timestamp >= ?",
          [connId, cutoff7dIso],
        );
      } else {
        rows = db.all(
          "SELECT promptTokens, completionTokens, timestamp FROM usageHistory WHERE provider = 'qwen-cloud-token-plan' AND timestamp >= ?",
          [cutoff7dIso],
        );
      }
    }
  } catch (err) {
    console.warn("[LocalQuotaMeter] DB query error:", err);
  }

  return qtpCalcSlidingWindowUsage(rows, now, psd);
}
function hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function atomicWrite(file, content) {
  const temporary = `${file}.quota-tracker-${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, { mode: fs.statSync(file).mode });
  fs.renameSync(temporary, file);
}

function assertVersion() {
  const version = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")).version;
  if (!SUPPORTED_VERSIONS.has(version)) {
    console.error(
      `[quota-tracker] 9Router ${version} differs from tested ${[...SUPPORTED_VERSIONS].join(", ")}; verifying bundle compatibility.`,
    );
  }
  return version;
}

function stripV1(content) {
  const marker = "/* QuotaTrackerPatch:v1 */";
  if (!content.includes(marker)) return content;
  const start = content.indexOf(marker);
  const dispatch = "let T={...T,...Z,github:";
  const end = content.indexOf(dispatch, start);
  if (end < 0) throw new Error("Cannot remove incomplete v1 quota patch");
  let clean = content.slice(0, start) + "let T={github:" + content.slice(end + dispatch.length);
  clean = clean.replace(
    'y=[...new Set([...d.A.filter(a=>a.features?.usageApikey).map(a=>a.id),"openrouter","deepseek","commandcode","xai"])]',
    API_KEY_ALLOW_MARKER,
  );
  clean = clean.replace(USAGE_ALLOW_PATCHED, USAGE_ALLOW_MARKER);
  return clean;
}

function runtimeFunctions() {
  return [
    qtpNum,
    qtpReset,
    qtpDate,
    qtpQuota,
    qtpBalance,
    qtpParseOpenRouter,
    qtpParseDeepSeek,
    qtpParseCommandCode,
    qtpNormalizeXai,
    qtpParseMimo,
    qtpParseCline,
    qtpLocalQuota,
    qtpCalcSlidingWindowUsage,
    qtpAlibaba,
  ]
    .map((fn) => fn.toString())
    .join("");
}

function injectedCode(grokFn) {
  return (
    MAIN_MARKER +
    runtimeFunctions() +
    'async function qtpGet(a,b,c){try{let g=await(0,d.proxyAwareFetch)(a,{method:"GET",headers:{Authorization:"Bearer "+b,Accept:"application/json"}},c),h=await g.json().catch(()=>null);return{ok:g.ok,status:g.status,body:h}}catch(a){return{ok:!1,status:0,error:a?.name==="AbortError"?"timeout":"request failed"}}}' +
    'function qtpError(a,b){return{message:b+" quota API "+(a.status?"error ("+a.status+").":a.error+"."),quotas:{}}}' +
    'async function qtpOpenRouter(a,b){if(!a)return{message:"OpenRouter API key not available.",quotas:{}};let c=await qtpGet("https://openrouter.ai/api/v1/credits",a,b);if(c.ok){let a=qtpParseOpenRouter(c.body);if(a)return a}let d=await qtpGet("https://openrouter.ai/api/v1/auth/key",a,b);if(d.ok){let a=qtpParseOpenRouter(d.body);if(a)return a}return qtpError(c.status===401||c.status===403?c:d,"OpenRouter")}' +
    'async function qtpDeepSeek(a,b){if(!a)return{message:"DeepSeek API key not available.",quotas:{}};let c=await qtpGet("https://api.deepseek.com/user/balance",a,b);if(!c.ok)return qtpError(c,"DeepSeek");let d=qtpParseDeepSeek(c.body);return d||{message:"DeepSeek connected. No balance data was returned.",quotas:{}}}' +
    'async function qtpCommandCode(a,b){if(!a)return{message:"CommandCode API key not available.",quotas:{}};let[c,d]=await Promise.all([qtpGet("https://api.commandcode.ai/alpha/billing/credits",a,b),qtpGet("https://api.commandcode.ai/alpha/billing/subscriptions",a,b)]);if(!c.ok)return qtpError(c,"CommandCode");let e=qtpParseCommandCode(c.body,d.ok?d.body:null);return e||{message:"CommandCode connected. No quota data was returned.",quotas:{}}}' +
    'async function qtpCookieGet(a,b,c){try{let g=await(0,d.proxyAwareFetch)(a,{method:"GET",headers:{Cookie:b,Accept:"application/json",Origin:"https://platform.xiaomimimo.com",Referer:"https://platform.xiaomimimo.com/#/console/balance","User-Agent":"Mozilla/5.0"}},c),h=await g.json().catch(()=>null);return{ok:g.ok,status:g.status,body:h}}catch(a){return{ok:!1,status:0,error:a?.name==="AbortError"?"timeout":"request failed"}}}' +
    'async function qtpMimo(a,b){let c=a?.quotaCookie||a?.cookie||process.env.MIMO_QUOTA_COOKIE;if(!c)return{message:"MiMo balance requires the console cookie in MIMO_QUOTA_COOKIE or providerSpecificData.quotaCookie.",quotas:{}};let d=await qtpCookieGet("https://platform.xiaomimimo.com/api/v1/balance",c,b);if(!d.ok)return qtpError(d,"MiMo");let e=qtpParseMimo(d.body);return e||{message:"MiMo connected. No balance data was returned.",quotas:{}}}' +
    'async function qtpCline(a,b){if(!a)return{message:"ClinePass credential not available.",quotas:{}};let[c,d]=await Promise.all([qtpGet("https://api.cline.bot/api/v1/users/me",a,b),qtpGet("https://api.cline.bot/api/v1/users/me/plan",a,b)]);if(!c.ok)return qtpError(c,"ClinePass");if(!d.ok)return qtpError(d,"ClinePass plan");let e=c.body?.data||c.body||{},g=e.id||e.uid;if(!g)return{message:"ClinePass user ID was not returned.",quotas:{}};let h=[],i="",j=Date.now()-2592e6;for(let c=0;c<100;c++){let e="https://api.cline.bot/api/v1/users/"+encodeURIComponent(g)+"/usages?limit=100"+(i?"&cursor="+encodeURIComponent(i):""),k=await qtpGet(e,a,b);if(!k.ok)return qtpError(k,"ClinePass usage");let l=k.body?.data||k.body||{},m=Array.isArray(l.items)?l.items:[];h.push(...m);i=String(l.nextToken||"");let n=m.map(a=>new Date(a?.createdAt).getTime()).filter(Number.isFinite),o=n.length?Math.min(...n):null;if(!i||!m.length||o!==null&&o<j)break}let k=qtpParseCline(d.body,h);return k||{message:"ClinePass connected. No active quota limits were returned.",quotas:{}}}' +
    `let qtpProviders={openrouter:a=>qtpOpenRouter(a.apiKey,a.proxyOptions),deepseek:a=>qtpDeepSeek(a.apiKey,a.proxyOptions),commandcode:a=>qtpCommandCode(a.apiKey,a.proxyOptions),xai:async a=>qtpNormalizeXai(await ${grokFn}(a.accessToken,a.providerSpecificData,a.proxyOptions)),"xiaomi-mimo":a=>qtpMimo(a.providerSpecificData,a.proxyOptions),clinepass:a=>qtpCline(a.apiKey||a.accessToken,a.proxyOptions),"qwen-cloud-token-plan":a=>qtpAlibaba(a)};`
  );
}

function buildUsagePatched(original) {
  const dispatchMatch = original.match(/let ([A-Za-z_$][\w$]*)=\{github:/);
  if (!dispatchMatch) {
    throw new Error("9Router usage dispatch marker not found");
  }
  const dispatchVar = dispatchMatch[1];
  const dispatchMarker = dispatchMatch[0];

  const grokMatch = original.match(
    /"grok-cli":([A-Za-z_$][\w$]*)=>([A-Za-z_$][\w$]*)\(\1\.accessToken,\1\.providerSpecificData,\1\.proxyOptions\)/,
  );
  if (!grokMatch) {
    throw new Error("Native Grok usage marker not found");
  }
  const grokArg = grokMatch[1];
  const grokFn = grokMatch[2];
  const grokMarker = grokMatch[0];

  const errorIdx = original.indexOf("Grok CLI usage error");
  if (errorIdx < 0) {
    throw new Error("Native Grok error marker not found");
  }
  const beforeError = original.slice(0, errorIdx);
  const resultRe = /return\{plan:([A-Za-z_$][\w$]*)\.plan,quotas:\1\.quotas\}/g;
  let resultMatch = null;
  let m;
  while ((m = resultRe.exec(beforeError))) resultMatch = m;
  if (!resultMatch) {
    throw new Error("Native Grok result marker not found");
  }
  const planVar = resultMatch[1];
  const resultMarker = `return{plan:${planVar}.plan,quotas:${planVar}.quotas}`;
  const resultPatched = `return{plan:${planVar}.plan,quotas:${planVar}.quotas,rawConfig:${planVar}.rawConfig}`;

  // 0.5.40: empty message object is closed then success return follows.
  // 0.5.45: empty branch is a separate if/return; only the success return needs rawConfig.
  const emptyMarker040 = `quotas:{}};return{plan:${planVar}.plan,quotas:${planVar}.quotas}`;
  const emptyPatched040 = `quotas:{},rawConfig:${planVar}.rawConfig};return{plan:${planVar}.plan,quotas:${planVar}.quotas,rawConfig:${planVar}.rawConfig}`;

  let patched = original;
  if (patched.includes(emptyMarker040)) {
    patched = patched.replace(emptyMarker040, emptyPatched040);
  } else {
    patched = patched.replace(resultMarker, resultPatched);
  }

  patched = patched
    .replace(dispatchMarker, `${injectedCode(grokFn)}let ${dispatchVar}={...qtpProviders,github:`)
    .replace(
      grokMarker,
      `"grok-cli":async ${grokArg}=>qtpNormalizeXai(await ${grokFn}(${grokArg}.accessToken,${grokArg}.providerSpecificData,${grokArg}.proxyOptions))`,
    );
  return patched;
}

function buildProvidersPatched(original) {
  const usagePattern =
    /((?:[A-Za-z_$][\w$]*\.)+filter\(([A-Za-z_$][\w$]*)=>\2\.features\?\.usage\)\.map\(\2=>\2\.id\))/;
  const apiKeyPattern =
    /((?:[A-Za-z_$][\w$]*\.)+filter\(([A-Za-z_$][\w$]*)=>\2\.features\?\.usageApikey\)\.map\(\2=>\2\.id\))/;
  if (!usagePattern.test(original)) {
    throw new Error("Provider client usage allow-list marker not found");
  }
  if (!apiKeyPattern.test(original)) {
    throw new Error("Provider client allow-list marker not found");
  }
  const usageProviders =
    '"openrouter","deepseek","commandcode","xai","xiaomi-mimo","clinepass","qwen-cloud-token-plan"';
  const apiKeyProviders =
    '"openrouter","deepseek","commandcode","xiaomi-mimo","clinepass","qwen-cloud-token-plan"';
  return original
    .replace(usagePattern, (expression) =>
      `[...new Set([...${expression},${usageProviders}])]`)
    .replace(apiKeyPattern, (expression) =>
      `[...new Set([...${expression},${apiKeyProviders}])]`)
    + PROVIDERS_MARKER;
}

function buildLegacyUiPatched(original) {
  if (original.includes(UI_MARKER)) return original;
  const matches = [
    {
      old: 'children:[a.used.toLocaleString()," / ",a.total>0?a.total.toLocaleString():"∞"]',
      replacement:
        'children:a.name.includes("(USD)")?[a.used.toLocaleString("pt-BR",{style:"currency",currency:"USD"})," / ",a.total.toLocaleString("pt-BR",{style:"currency",currency:"USD"})]:[a.used.toLocaleString()," / ",a.total>0?a.total.toLocaleString():"∞"]' +
        UI_MARKER,
    },
    {
      old: 'children:[e.used.toLocaleString()," / ",e.total>0?e.total.toLocaleString():"∞"]',
      replacement:
        'children:e.name.includes("(USD)")?[e.used.toLocaleString("pt-BR",{style:"currency",currency:"USD"})," / ",e.total.toLocaleString("pt-BR",{style:"currency",currency:"USD"})]:[e.used.toLocaleString()," / ",e.total>0?e.total.toLocaleString():"∞"]' +
        UI_MARKER,
    },
  ];
  const match = matches.find(({ old }) => original.includes(old));
  if (!match) throw new Error("Quota currency renderer marker not found");
  return original.replace(match.old, match.replacement);
}

function buildUiPatched(original) {
  if (original.includes(UI_STATUS_MARKER)) return original;
  let result = buildLegacyUiPatched(original);
  const matches = [
    {
      old:
        'i?.message?(0,d.jsx)("div",{className:"text-center py-5",children:(0,d.jsx)("p",{className:"text-xs text-text-muted",children:i.message})}):(0,d.jsx)(r,{quotas:D,compact:!0,sortMode:"default",showSortLabel:"codex"===c.provider&&"default"!==at,onHideQuota:a=>aZ(c.provider,a)})',
      replacement:
        'i?.message?(0,d.jsx)("div",{className:"text-center py-5",children:(0,d.jsx)("p",{className:"text-xs text-text-muted",children:i.message})}):(0,d.jsxs)("div",{children:[i?.raw?.source?(0,d.jsx)("p",{className:"text-[10px] text-text-muted mb-1",children:`${i.raw.source} · ${i.raw.status||"ok"} · ${i.raw.fetchedAt||""}`}):null,(0,d.jsx)(r,{quotas:D,compact:!0,sortMode:"default",showSortLabel:"codex"===c.provider&&"default"!==at,onHideQuota:a=>aZ(c.provider,a)})]})' +
        UI_STATUS_MARKER,
    },
    {
      old:
        'o?.message?(0,a.jsx)("div",{className:"text-center py-5",children:(0,a.jsx)("p",{className:"text-xs text-text-muted",children:o.message})}):(0,a.jsx)(w,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})',
      replacement:
        'o?.message?(0,a.jsx)("div",{className:"text-center py-5",children:(0,a.jsx)("p",{className:"text-xs text-text-muted",children:o.message})}):(0,a.jsxs)("div",{children:[o?.raw?.source?(0,a.jsx)("p",{className:"text-[10px] text-text-muted mb-1",children:`${o.raw.source} · ${o.raw.status||"ok"} · ${o.raw.fetchedAt||""}`}):null,(0,a.jsx)(w,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})]})' +
        UI_STATUS_MARKER,
    },
    {
      old:
        'o?.message?(0,a.jsx)("div",{className:"text-center py-5",children:(0,a.jsx)("p",{className:"text-xs text-text-muted",children:o.message})}):(0,a.jsx)(k,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})',
      replacement:
        'o?.message?(0,a.jsx)("div",{className:"text-center py-5",children:(0,a.jsx)("p",{className:"text-xs text-text-muted",children:o.message})}):(0,a.jsxs)("div",{children:[o?.raw?.source?(0,a.jsx)("p",{className:"text-[10px] text-text-muted mb-1",children:`${o.raw.source} · ${o.raw.status||"ok"} · ${o.raw.fetchedAt||""}`}):null,(0,a.jsx)(k,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})]})' +
        UI_STATUS_MARKER,
    },
  ];
  const matched = matches.filter(({ old }) => result.includes(old));
  if (
    matched.length !== 1 ||
    result.indexOf(matched[0].old) !== result.lastIndexOf(matched[0].old)
  ) {
    throw new Error("Quota status card branch not found");
  }
  return result.replace(matched[0].old, matched[0].replacement);
}

function isCatalogTarget(relative, original = "") {
  return (
    relative === "chunks/615.js" ||
    relative.includes("1321-") ||
    OPENCODE_GO_CATALOG_RELATIVES.has(relative) ||
    OPENCODE_GO_RUNTIME_RELATIVES.has(relative) ||
    original.includes("40615:(")
  );
}

function markerFor(relative, content = "") {
  if (relative === USAGE_RELATIVE) return MAIN_MARKER;
  if (UI_RELATIVES.has(relative)) return UI_STATUS_MARKER;
  if (isCatalogTarget(relative, content)) return PROVIDER_CATALOG_MARKER;
  return PROVIDERS_MARKER;
}

function buildLegacyUsagePatched(original) {
  const grokMatch = original.match(
    /"grok-cli":([A-Za-z_$][\w$]*)=>([A-Za-z_$][\w$]*)\(\1\.accessToken,\1\.providerSpecificData,\1\.proxyOptions\)/,
  );
  const grokFn = grokMatch ? grokMatch[2] : "f";
  const newPatched = buildUsagePatched(original);
  const oldFns =
    `/* QuotaTrackerPatch:v2 */let qtpAlibabaCache=new Map();function qtpNum(value, fallback = NaN) {\n  const number = Number(value);\n  return Number.isFinite(number) ? number : fallback;\n}function qtpReset(value) {\n  if (!value || typeof value === "boolean" || Array.isArray(value)) return null;\n  if (typeof value === "number") return Math.max(0, value);\n  const date = new Date(value).getTime();\n  return Number.isFinite(date) ? date : null;\n}function qtpQuota(used, total, resetAt) {\n  const safeUsed = qtpNum(used);\n  const safeTotal = qtpNum(total);\n  if (!Number.isFinite(safeUsed) || !Number.isFinite(safeTotal) || safeTotal <= 0) return null;\n  const remaining = Math.max(0, safeTotal - safeUsed);\n  const remainingPercentage = Math.min(100, Math.max(0, Math.round((remaining / safeTotal) * 100)));\n  return {\n    used: safeUsed,\n    total: safeTotal,\n    remainingPercentage,\n    resetAt: qtpReset(resetAt),\n  };\n}function qtpBalance(available, total, currency = "USD") {\n  const safeAvailable = qtpNum(available);\n  const safeTotal = qtpNum(total);\n  if (!Number.isFinite(safeAvailable)) return null;\n  const used = Number.isFinite(safeTotal) && safeTotal >= safeAvailable ? safeTotal - safeAvailable : 0;\n  return {\n    name: \`Balance (\${currency})\`,\n    used,\n    total: Number.isFinite(safeTotal) && safeTotal > 0 ? safeTotal : 0,\n    remainingPercentage: Number.isFinite(safeTotal) && safeTotal > 0 ? Math.min(100, Math.max(0, Math.round((safeAvailable / safeTotal) * 100))) : 0,\n    resetAt: null,\n  };\n}function qtpParseOpenRouter(body) {\n  const data = body?.data;\n  if (!data) return null;\n  const total = qtpNum(data.total_credits);\n  const usage = qtpNum(data.total_usage);\n  if (Number.isFinite(total) && Number.isFinite(usage)) {\n    return { plan: "OpenRouter", quotas: { Balance: qtpBalance(total - usage, total) } };\n  }\n  const limit = qtpNum(data.limit);\n  if (Number.isFinite(limit) && Number.isFinite(usage)) {\n    return { plan: "OpenRouter", quotas: { Balance: qtpBalance(limit - usage, limit) } };\n  }\n  return null;\n}function qtpParseDeepSeek(body) {\n  if (!body?.is_available) return null;\n  const info = body.balance_infos?.[0];\n  if (!info) return null;\n  const total = qtpNum(info.total_balance);\n  const granted = qtpNum(info.granted_balance);\n  const toppedUp = qtpNum(info.topped_up_balance);\n  if (Number.isFinite(total)) return { plan: "DeepSeek", quotas: { Balance: qtpBalance(total, total) } };\n  if (Number.isFinite(granted) && Number.isFinite(toppedUp)) {\n    const sum = granted + toppedUp;\n    return { plan: "DeepSeek", quotas: { Balance: qtpBalance(sum, sum) } };\n  }\n  return null;\n}function qtpParseCommandCode(creditsBody, subsBody) {\n  const cData = creditsBody?.data;\n  const sData = subsBody?.data;\n  const currentC = qtpNum(cData?.current_credits);\n  const totalC = qtpNum(cData?.total_credits);\n  if (Number.isFinite(currentC) && Number.isFinite(totalC) && totalC > 0) {\n    return { plan: "CommandCode", quotas: { Credits: qtpQuota(totalC - currentC, totalC) } };\n  }\n  const tier = sData?.subscription_tier;\n  const subC = qtpNum(sData?.credits_included);\n  if (tier && Number.isFinite(subC) && subC > 0 && Number.isFinite(currentC)) {\n    return { plan: \`CommandCode (\${tier})\`,\nquotas: { Credits: qtpQuota(subC - currentC, subC) } };\n  }\n  return null;\n}function qtpNormalizeXai(raw) {\n  if (!raw || typeof raw !== "object" || !raw.quotas) return raw;\n  const copy = { ...raw, quotas: { ...raw.quotas } };\n  for (const [key, item] of Object.values(copy.quotas)) {\n    if (item && item.total === 0 && item.used === 0 && Number.isFinite(item.remainingPercentage)) {\n      copy.quotas[key] = { ...item, total: 100, used: Math.max(0, Math.min(100, 100 - item.remainingPercentage)) };\n    }\n  }\n  return copy;\n}function qtpParseMimo(body) {\n  const data = body?.data;\n  if (!data) return null;\n  const total = qtpNum(data.totalBalance);\n  if (Number.isFinite(total)) return { plan: "Xiaomi MiMo", quotas: { Balance: qtpBalance(total, total) } };\n  return null;\n}function qtpParseCline(userBody, planBody, usageItems) {\n  const plan = planBody?.data?.planName || planBody?.planName || "ClinePass";\n  const total = qtpNum(planBody?.data?.allowance || planBody?.allowance);\n  if (!Array.isArray(usageItems) || !Number.isFinite(total) || total <= 0) return null;\n  const now = Date.now();\n  const h5 = now - 5 * 3600 * 1000;\n  const d7 = now - 7 * 86400 * 1000;\n  const d30 = now - 30 * 86400 * 1000;\n  let u5 = 0, u7 = 0, u30 = 0;\n  for (const item of usageItems) {\n    const t = new Date(item.createdAt || item.timestamp || 0).getTime();\n    const cost = qtpNum(item.cost || item.credits || item.tokens || 1);\n    if (t >= h5) u5 += cost;\n    if (t >= d7) u7 += cost;\n    if (t >= d30) u30 += cost;\n  }\n  return {\n    plan,\n    quotas: {\n      "5 hour window": qtpQuota(u5, total),\n      "7 day window": qtpQuota(u7, total),\n      "30 day window": qtpQuota(u30, total),\n    },\n  };\n}function qtpAlibabaPercent(raw) {\n  if (raw === null || raw === undefined) return null;\n  if (typeof raw === "boolean") return null;\n  if (typeof raw === "number") {\n    return Number.isFinite(raw) ? raw : null;\n  }\n  if (typeof raw === "string") {\n    const trimmed = raw.trim().replace(/%/g, "");\n    const num = Number(trimmed);\n    return Number.isFinite(num) ? num : null;\n  }\n  return null;\n}function qtpFindAlibabaUsage(data, now = Date.now()) {\n  if (!data || typeof data !== "object") return null;\n  const stack = [data];\n  let best = null;\n  let bestTime = -1;\n  while (stack.length > 0) {\n    const current = stack.pop();\n    if (!current || typeof current !== "object") continue;\n    if (Array.isArray(current)) {\n      for (const item of current) stack.push(item);\n      continue;\n    }\n    const hasFive = "fiveHour" in current || "5hour" in current || "five_hour" in current;\n    const hasSeven = "sevenDay" in current || "7day" in current || "seven_day" in current;\n    if (hasFive || hasSeven) {\n      const fiveVal = current.fiveHour ?? current["5hour"] ?? current.five_hour;\n      const sevenVal = current.sevenDay ?? current["7day"] ?? current.seven_day;\n      const fivePct = qtpAlibabaPercent(fiveVal);\n      const sevenPct = qtpAlibabaPercent(sevenVal);\n      if (fivePct !== null || sevenPct !== null) {\n        const timeCandidate = qtpReset(current.updateTime || current.gmtModified || current.time || now);\n        if (timeCandidate > bestTime) {\n          bestTime = timeCandidate;\n          best = { fiveHour: fiveVal, sevenDay: sevenVal };\n        }\n      }\n    }\n    for (const key of Object.keys(current)) {\n      const child = current[key];\n      if (child && typeof child === "object") stack.push(child);\n    }\n  }\n  return best;\n}function qtpAlibabaWindow(windowData, now = Date.now()) {\n  if (windowData === null || windowData === undefined) return null;\n  if (typeof windowData === "boolean") return null;\n  let used = null;\n  let resetAt = null;\n  if (typeof windowData === "number" || typeof windowData === "string") {\n    used = qtpAlibabaPercent(windowData);\n  } else if (typeof windowData === "object") {\n    used = qtpAlibabaPercent(\n      windowData.usedPercentage ?? windowData.used_percentage ?? windowData.used ?? windowData.percentage,\n    );\n    resetAt = qtpReset(windowData.resetAt ?? windowData.reset_at ?? windowData.resetTime ?? windowData.nextResetTime);\n  }\n  if (used === null) return null;\n  return qtpQuota(used, 100, resetAt);\n}function qtpParseAlibabaTokenPlan(body, now = Date.now()) {\n  const source = body && typeof body === "object" ? body : null;\n  const usage = qtpFindAlibabaUsage(source, now);\n  if (!usage) return null;\n  const fiveHour = qtpAlibabaWindow(usage.fiveHour, now);\n  const sevenDay = qtpAlibabaWindow(usage.sevenDay, now);\n  if (!fiveHour || !sevenDay) return null;\n  return {\n    plan: "Alibaba Token Plan",\n    quotas: {\n      "5 hour window (%)": fiveHour,\n      "7 day window (%)": sevenDay,\n    },\n  };\n}function qtpSafeAlibabaReason(error) {\n  const msg = String(error?.message || error || "");\n  if (msg.includes("session unavailable")) return "session unavailable";\n  if (msg.includes("authentication failed") || msg.includes("401") || msg.includes("403")) {\n    return "authentication failed";\n  }\n  return "quota unavailable";\n}async function qtpFetchAlibabaPayload(fetcher, cookie, secToken) {\n  const url = "https://cs-data.qwencloud.com/data/api.json?action=IntlBroadScopeAspnGateway&product=sfm_bailian&api=zeldaHttp.apikeyMgr.%2Ftokenplan%2Fpersonal%2Fapi%2Fv2%2Fusage&_v=undefined";\n  const feTraceId = typeof crypto !== "undefined" && typeof crypto.randomBytes === "function" ? crypto.randomBytes(16).toString("hex") : Date.now().toString(36) + Math.random().toString(36).substring(2);\n  const body = new URLSearchParams({ product: "sfm_bailian", action: "IntlBroadScopeAspnGateway", sec_token: secToken, region: "ap-southeast-1", language: "en-US", params: JSON.stringify({ Api: "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/usage", V: "1.0", Data: { cornerstoneParam: { feTraceId, feURL: "https://home.qwencloud.com/billing/subscription/token-plan-individual", protocol: "V2", console: "ONE_CONSOLE", productCode: "p_efm", domain: "home.qwencloud.com", consoleSite: "QWENCLOUD", userNickName: "", userPrincipalName: "", xsp_lang: "en-US" } } }) }).toString();\n  let res;\n  try {\n    res = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie, Referer: "https://home.qwencloud.com/billing/subscription/token-plan-individual", Origin: "https://home.qwencloud.com", "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/plain, */*" }, body, signal: AbortSignal.timeout(8000) });\n  } catch (err) {\n    throw new Error("quota unavailable");\n  }\n  if (res.status === 401 || res.status === 403) throw new Error("authentication failed");\n  if (!res.ok) throw new Error("quota unavailable");\n  try { return await res.json(); } catch (err) { throw new Error("quota unavailable"); }\n}async function qtpFetchAlibabaTokenPlan(fetcher, cache, env, now = Date.now()) {\n  const cookie = String(env?.ALIBABA_TOKEN_PLAN_QUOTA_COOKIE || "").trim();\n  const secToken = String(env?.ALIBABA_TOKEN_PLAN_SEC_TOKEN || "").trim();\n  if (!cookie || !secToken) return { status: "unavailable", source: "alibaba-console", reason: "session unavailable" };\n  const cached = cache.get("qwen-cloud-token-plan");\n  if (cached && now - cached.fetchedAt < 60000) return { ...cached.value, status: "ok" };\n  try {\n    const payload = await qtpFetchAlibabaPayload(fetcher, cookie, secToken);\n    const parsed = qtpParseAlibabaTokenPlan(payload, now);\n    if (!parsed) throw new Error("quota unavailable");\n    const value = { ...parsed, status: "ok", source: "alibaba-console", fetchedAt: new Date(now).toISOString() };\n    cache.set("qwen-cloud-token-plan", { value, fetchedAt: now });\n    return value;\n  } catch (error) {\n    if (cached && now - cached.fetchedAt <= 300000) return { ...cached.value, status: "stale" };\n    return { status: "unavailable", source: "alibaba-console", reason: qtpSafeAlibabaReason(error) };\n  }\n}async function qtpAlibaba(a){let b=await qtpFetchAlibabaTokenPlan((u,i)=>(0,d.proxyAwareFetch)(u,i,a.proxyOptions),qtpAlibabaCache,process.env,Date.now());return b&&"unavailable"===b.status?{message:"Console Alibaba: quota oficial indisponível — sessão ausente ou expirada.",quotas:{},status:"unavailable",source:"alibaba-console",reason:b.reason}:b}let qtpProviders={openrouter:a=>qtpOpenRouter(a.apiKey,a.proxyOptions),deepseek:a=>qtpDeepSeek(a.apiKey,a.proxyOptions),commandcode:a=>qtpCommandCode(a.apiKey,a.proxyOptions),xai:async a=>qtpNormalizeXai(await ${grokFn}(a.accessToken,a.providerSpecificData,a.proxyOptions)),"xiaomi-mimo":a=>qtpMimo(a.providerSpecificData,a.proxyOptions),clinepass:a=>qtpCline(a.apiKey||a.accessToken,a.proxyOptions),"qwen-cloud-token-plan":a=>qtpAlibaba(a)};`;
  const newIdx = newPatched.indexOf("/* QuotaTrackerPatch:v2 */");
  const newEndIdx =
    newPatched.indexOf("let qtpProviders=") +
    newPatched.slice(newPatched.indexOf("let qtpProviders=")).indexOf("};") +
    2;
  return newPatched.slice(0, newIdx) + oldFns + newPatched.slice(newEndIdx);
}
function buildLegacyPatched(relative, original) {
  if (relative === USAGE_RELATIVE) return buildLegacyUsagePatched(original);
  if (UI_RELATIVES.has(relative)) return buildLegacyUiPatched(original);
  if (OPENCODE_GO_DIRECT_RELATIVES.has(relative)) {
    return buildProviderCatalogPatched(original);
  }
  if (OPENCODE_GO_CATALOG_RELATIVES.has(relative)) {
    return buildProvidersPatched(buildProviderCatalogPatched(original));
  }
  return buildProvidersPatched(original);
}

function buildPatched(relative, original) {
  if (relative === USAGE_RELATIVE) return buildUsagePatched(original);
  if (UI_RELATIVES.has(relative)) return buildUiPatched(original);
  if (isCatalogTarget(relative, original)) {
    const catalog = buildProviderCatalogPatched(original);
    if (
      OPENCODE_GO_DIRECT_RELATIVES.has(relative)
    ) {
      return catalog;
    }
    return buildProvidersPatched(catalog);
  }
  return buildProvidersPatched(original);
}

function originalPath(relative) {
  return path.join(ORIGINALS_DIR, "server", relative);
}

function saveOriginal(relative, content) {
  const file = originalPath(relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, content);
  }
}

function apply() {
  assertVersion();
  const entries = Object.entries(CATALOG_HASHES).map(([relative, expectedHash]) => {
    const file = path.join(SERVER_ROOT, relative);
    let content = fs.readFileSync(file, "utf8");
    if (relative === USAGE_RELATIVE) content = stripV1(content);
    return { relative, expectedHash, file, content };
  });
  const patchedCount = entries.filter(({ relative, content }) =>
    content.includes(markerFor(relative, content)),
  ).length;
  if (patchedCount === entries.length) {
    let needsUpdate = false;
    for (const entry of entries) {
      const saved = originalPath(entry.relative);
      if (!fs.existsSync(saved)) {
        throw new Error(`Original bundle unavailable for verification: ${entry.relative}`);
      }
      const original = fs.readFileSync(saved, "utf8");
      if (hash(original) !== entry.expectedHash) {
        throw new Error(`Saved original hash mismatch: ${entry.relative}`);
      }
      if (entry.content !== buildPatched(entry.relative, original)) {
        needsUpdate = true;
      }
    }
    if (!needsUpdate) return false;
  }
  const hasLegacyOrPartial = entries.some(
    ({ content }) =>
      LEGACY_MARKERS.some((m) => content.includes(m)) ||
      content.includes(PROVIDER_CATALOG_MARKER) ||
      content.includes(UI_STATUS_MARKER) ||
      content.includes(MAIN_MARKER) ||
      content.includes(PROVIDERS_MARKER),
  );

  if (hasLegacyOrPartial) {
    const restore = [];
    for (const entry of entries) {
      const isClean = hash(entry.content) === entry.expectedHash;
      if (isClean) continue;

      const hasRecognizedMarker =
        LEGACY_MARKERS.some((m) => entry.content.includes(m)) ||
        entry.content.includes(PROVIDER_CATALOG_MARKER) ||
        entry.content.includes(UI_STATUS_MARKER) ||
        entry.content.includes(MAIN_MARKER) ||
        entry.content.includes(PROVIDERS_MARKER);
      if (!hasRecognizedMarker) {
        throw new Error(`Unsafe partial patch recovery for ${entry.relative}`);
      }

      const saved = originalPath(entry.relative);
      if (!fs.existsSync(saved)) {
        throw new Error(`Original bundle unavailable for recovery: ${entry.relative}`);
      }
      const original = fs.readFileSync(saved, "utf8");
      if (hash(original) !== entry.expectedHash) {
        throw new Error(`Saved original hash mismatch for ${entry.relative}`);
      }
      const expectedNew = buildPatched(entry.relative, original);
      const expectedLegacy = buildLegacyPatched(entry.relative, original);
      const isRecognizedUsage = entry.relative === USAGE_RELATIVE && entry.content.includes(MAIN_MARKER);
      if (entry.content !== expectedNew && entry.content !== expectedLegacy && !isRecognizedUsage) {
        throw new Error(`Unsafe partial patch recovery for ${entry.relative}`);
      }
      restore.push({ file: entry.file, original });
    }
    for (const entry of restore) atomicWrite(entry.file, entry.original);
    return apply();
  }

  for (const entry of entries) {
    const actualHash = hash(entry.content);
    if (actualHash !== entry.expectedHash) {
      throw new Error(`Unsupported bundle hash for ${entry.relative}: ${actualHash}`);
    }
  }
  const outputs = entries.map((entry) => ({
    ...entry,
    patched: buildPatched(entry.relative, entry.content),
  }));
  for (const entry of entries) saveOriginal(entry.relative, entry.content);
  for (const output of outputs) atomicWrite(output.file, output.patched);
  return true;
}

function rollback() {
  assertVersion();
  const entries = Object.keys(CATALOG_HASHES).map((relative) => {
    const file = path.join(SERVER_ROOT, relative);
    const saved = originalPath(relative);
    if (!fs.existsSync(saved)) {
      throw new Error(`Original bundle unavailable for rollback: ${relative}`);
    }
    const original = fs.readFileSync(saved, "utf8");
    const expectedHash = CATALOG_HASHES[relative];
    if (hash(original) !== expectedHash) {
      throw new Error(`Saved original hash mismatch for rollback: ${relative}`);
    }
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const isClean = hash(current) === expectedHash;
    const hasMarker =
      !isClean &&
      (LEGACY_MARKERS.some((m) => current.includes(m)) ||
        current.includes(PROVIDER_CATALOG_MARKER) ||
        current.includes(UI_STATUS_MARKER) ||
        current.includes(MAIN_MARKER) ||
        current.includes(PROVIDERS_MARKER));
    const expectedNew = buildPatched(relative, original);
    const expectedLegacy = buildLegacyPatched(relative, original);
    return { relative, file, original, expectedNew, expectedLegacy, current, isClean, hasMarker };
  });

  const patchedCount = entries.filter(({ hasMarker }) => hasMarker).length;
  if (patchedCount === 0) return false;
  if (patchedCount !== entries.length) {
    throw new Error("Partial quota patch detected; refusing unsafe rollback");
  }

  for (const entry of entries) {
    if (entry.hasMarker) {
      const isRecognizedUsage = entry.relative === USAGE_RELATIVE && entry.current.includes(MAIN_MARKER);
      if (entry.current !== entry.expectedNew && entry.current !== entry.expectedLegacy && !isRecognizedUsage) {
        throw new Error(`Patched bundle changed unexpectedly: ${entry.relative}`);
      }
    }
  }

  for (const entry of entries) {
    if (entry.hasMarker) {
      atomicWrite(entry.file, entry.original);
    }
  }
  return true;
}
function sanitize() {
  let restored = 0;
  for (const relative of Object.keys(CATALOG_HASHES)) {
    const file = path.join(SERVER_ROOT, relative);
    if (!fs.existsSync(file)) continue;
    const current = fs.readFileSync(file, "utf8");
    const hasMarker =
      LEGACY_MARKERS.some((m) => current.includes(m)) ||
      current.includes(PROVIDER_CATALOG_MARKER) ||
      current.includes(UI_STATUS_MARKER) ||
      current.includes(MAIN_MARKER) ||
      current.includes(PROVIDERS_MARKER);
    if (!hasMarker) continue;
    const saved = originalPath(relative);
    if (!fs.existsSync(saved)) {
      throw new Error(`Original bundle unavailable for sanitization: ${relative}`);
    }
    const original = fs.readFileSync(saved, "utf8");
    if (hash(original) !== CATALOG_HASHES[relative]) {
      throw new Error(`Saved original hash mismatch for sanitization: ${relative}`);
    }
    const expectedNew = buildPatched(relative, original);
    const expectedLegacy = buildLegacyPatched(relative, original);
    if (current !== expectedNew && current !== expectedLegacy) {
      throw new Error(`Refusing to sanitize an unknown patched bundle: ${relative}`);
    }
    atomicWrite(file, original);
    restored++;
  }
  return restored;
}

function check() {
  const usage = fs.existsSync(USAGE_CHUNK) ? fs.readFileSync(USAGE_CHUNK, "utf8") : "";
  const catalogPatched = Object.keys(CATALOG_HASHES).filter((relative) => {
    const file = path.join(SERVER_ROOT, relative);
    if (!fs.existsSync(file)) return false;
    const content = fs.readFileSync(file, "utf8");
    return content.includes(markerFor(relative, content));
  }).length;
  const state = {
    version: JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")).version,
    catalogVariant: CATALOG_VARIANT,
    usagePatched: usage.includes(MAIN_MARKER),
    catalogPatched,
    catalogTotal: Object.keys(CATALOG_HASHES).length,
    usageHash: hash(usage),
  };
  console.log(JSON.stringify(state, null, 2));
  return state;
}

function main() {
  const command = process.argv[2] || "--check";
  if (command === "--apply") console.log(apply() ? "applied" : "already applied");
  else if (command === "--rollback") {
    console.log(rollback() ? "rolled back" : "already clean");
  } else if (command === "--sanitize") {
    const restored = sanitize();
    console.log(restored ? `sanitized ${restored} bundle(s)` : "already clean");
  } else if (command === "--check") check();
  else throw new Error("usage: --check|--apply|--rollback|--sanitize");
}

module.exports = {
  qtpBalance,
  qtpParseCommandCode,
  qtpParseDeepSeek,
  qtpParseCline,
  qtpParseMimo,
  qtpParseOpenRouter,
  qtpNormalizeXai,
  qtpQuota,
  qtpLocalQuota,
  qtpCalcSlidingWindowUsage,
  qtpAlibaba,
  buildProviderCatalogPatched,
  buildProvidersPatched,
  buildUiPatched,
  buildLegacyPatched,
};

if (require.main === module) main();
