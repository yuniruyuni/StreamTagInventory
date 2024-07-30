import React from "react";
import ReactDOM from "react-dom/client";
import useSWR from "swr";
import "./index.css";

import { CategorySelector } from "~/CategorySelector";
import type { Category } from "~/model/category";
import { TwitchAuthContext, TwitchAuthProvider } from "./TwitchAuth";
import { twitch } from "./fetcher";

function MainScreen() {
    const token = React.useContext(TwitchAuthContext);
    const [category, setCategory] = React.useState<Category | undefined>(undefined);

    const { data: users, isLoading, error } = useSWR(["https://api.twitch.tv/helix/users", token], twitch.get);

    if (isLoading) return <div>loading...</div>;
    if (error) return <div>failed to load</div>;

    return (
        <div>
            <span>user: {users.data[0].display_name}</span>
            <CategorySelector value={category} onChange={setCategory} />
        </div>
    );
}


const root = document.getElementById("root");
if( root ) {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <TwitchAuthProvider>
                <MainScreen />
            </TwitchAuthProvider>
        </React.StrictMode>
    );
}