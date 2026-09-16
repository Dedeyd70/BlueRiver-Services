import { useEffect } from "react";

const SCRIPT_SRC = "https://elfsightcdn.com/platform.js";
const APP_ID = "26484372-71e1-46a0-9e23-736cb47b2a36";

/** Loads the Elfsight platform script once and renders the Google Reviews widget. */
const ElfsightReviews = () => {
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return <div className={`elfsight-app-${APP_ID}`} data-elfsight-app-lazy />;
};

export default ElfsightReviews;
