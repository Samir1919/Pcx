import ModelSpecifications from "./workspace";
export default async function ModelSpecificationsPage({params}){const{id}=await params;return <ModelSpecifications modelId={id}/>;}
