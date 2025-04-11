const MiniCssExtractPlugin = require("mini-css-extract-plugin")

module.exports = {
  mode: "production", // or "development" based on your needs
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
      chunkFilename: "[id].css",
    }),
  ],
}
