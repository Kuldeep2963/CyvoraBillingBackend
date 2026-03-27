import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  styles: {
    global: {
      /* Firefox */
      "*": {
        scrollbarWidth: "thin",
        scrollbarColor: "#d3d3d3 transparent",
      },

      /* Chrome, Edge, Safari */
      "*::-webkit-scrollbar": {
        width: "8px",
        height: "8px",
      },

      "*::-webkit-scrollbar-track": {
        background: "transparent",
      },

      "*::-webkit-scrollbar-thumb": {
        backgroundColor: "#d3d3d3",
        borderRadius: "4px",
      },

      "*::-webkit-scrollbar-thumb:hover": {
        backgroundColor: "#a9a9a9",
      },
    },
  },
});

export default theme;
