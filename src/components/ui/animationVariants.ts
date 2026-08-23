export const staggerItem = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] as const } },
};
