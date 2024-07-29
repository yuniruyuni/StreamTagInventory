import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const root = document.getElementById("root");
if( root ) {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <div>
                Hello, world
            </div>
        </React.StrictMode>
    );
}