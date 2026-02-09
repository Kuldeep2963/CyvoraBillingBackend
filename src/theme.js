import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  styles: {
    global: {
      /* Firefox */
      "*": {
        scrollbarWidth: "thin",
        scrollbarColor: "#3182ce #f1f1f1",
      },

      /* Chrome, Edge, Safari */
      "*::-webkit-scrollbar": {
        width: "6px",
        height: "6px",
      },

      "*::-webkit-scrollbar-track": {
        background: "#f1f1f1",
      },

      "*::-webkit-scrollbar-thumb": {
        backgroundColor: "#3182ce",
        borderRadius: "8px",
      },

      "*::-webkit-scrollbar-thumb:hover": {
        backgroundColor: "#2b6cb0",
      },
    },
  },
});

export default theme;
