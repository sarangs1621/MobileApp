/** Metro static image imports resolve to an asset-registry id (number). */
declare module "*.png" {
  const assetId: number;
  export default assetId;
}
