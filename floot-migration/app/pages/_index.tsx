import React, {useEffect,useRef} from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { recipeDocument } from "../helpers/recipeDocument";
import styles from "./_index.module.css";
export default function Recipes() {
 const ref=useRef<HTMLIFrameElement>(null);const navigate=useNavigate();useEffect(()=>{const listener=(e:MessageEvent)=>{if(e.source===ref.current?.contentWindow&&e.data?.type==='bd-navigate'&&e.data.path==='/studio')navigate('/studio');};window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);},[navigate]);
 return <><Helmet><title>Bloody Dave's Recipes</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><link rel="manifest" href="/manifest.json"/></Helmet><iframe ref={ref} className={styles.app} title="Bloody Dave recipe library" srcDoc={recipeDocument} /></>;
}
