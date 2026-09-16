import { useEffect } from "react";

const SCRIPT_SRC = "https://elfsightcdn.com/platform.js";
const APP_CLASS = "elfsight-app-26484372-71e1-46a0-9e23-736cb47b2a36";

/** Embeds the Elfsight Google Reviews widget. Loads the platform script once. */
const ElfsightReviews = () => {
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return <div className={APP_CLASS} data-elfsight-app-lazy />;
};

export default ElfsightReviews;
