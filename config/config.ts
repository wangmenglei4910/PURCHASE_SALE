export default {
  // ... 其他配置
  chainWebpack(config) {
    config.module
      .rule('mp3')
      .test(/\.mp3$/)
      .use('file-loader')
      .loader('file-loader');

    // 图片压缩配置
    config.module
      .rule('images')
      .test(/\.(png|jpe?g|gif|webp)$/i)
      .use('url-loader')
      .loader('url-loader')
      .options({
        limit: 8192, // 小于 8kb 的图片会被转为 base64
        name: 'static/[name].[hash:8].[ext]',
      })
      .end()
      .use('image-webpack-loader') // 添加图片压缩
      .loader('image-webpack-loader')
      .options({
        mozjpeg: {
          quality: 65,
          progressive: true,
        },
        optipng: {
          enabled: false,
        },
        pngquant: {
          quality: [0.65, 0.90],
          speed: 4,
        },
        gifsicle: {
          interlaced: false,
        },
        webp: {
          quality: 75,
        },
      });
  }
}; 